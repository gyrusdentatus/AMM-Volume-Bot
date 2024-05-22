// Import required modules
const { ethers, JsonRpcProvider } = require("ethers");
const scheduler = require("node-schedule");
const nodemailer = require("nodemailer");
const figlet = require("figlet");
require("dotenv").config();
const fs = require("fs");

// Import environment variables
const WALLET_ADDRESS = process.env.USER_ADDRESS;
const PRIV_KEY = process.env.USER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;

// Storage obj
let report = [];
let trades = {
    previousTrade: "",
    nextTrade: "",
    count: 0,
};

// Contract ABI (please grant ERC20 approvals)
const uniswapABI = require("./ABI/uniswapABI");
const explorer = "https://bscscan.com/tx/";
const MIN_AMT = 0.001; // est. gas costs
const x = 4;

// All relevant addresses needed (is WBNB and PCS on BSC)
const KTP = "0xc6C0C0f54a394931a5b224c8b53406633e35eeE7";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WETH = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const uniswapAdr = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

// Ethers vars for web3 connections
let wallet, provider, uniswapRouter;

// Main Function
const main = async () => {
    try {
        console.log(
            figlet.textSync("AMMTrade", {
                font: "Standard",
                horizontalLayout: "default",
                verticalLayout: "default",
                width: 80,
                whitespaceBreak: true,
            })
        );
        let tradesExists = false;

        // Check if trades file exists
        if (!fs.existsSync("./next.json")) await storeData();

        // Get stored values from file
        const storedData = JSON.parse(fs.readFileSync("./next.json"));

        // Not first launch, check data
        if ("nextTrade" in storedData) {
            const nextTrade = new Date(storedData.nextTrade);
            trades["count"] = new Number(storedData["count"]);
            console.log(`Current Count: ${trades["count"]}`);

            // Restore trades schedule
            if (nextTrade > new Date()) {
                console.log("Restored Trade: " + nextTrade);
                scheduler.scheduleJob(nextTrade, AMMTrade);
                tradesExists = true;
            }
        }

        // No previous launch
        if (!tradesExists) {
            AMMTrade();
        }
    } catch (error) {
        console.error(error);
    }
};

// Ethers vars connect
const connect = async () => {
    provider = new JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(PRIV_KEY, provider);
    uniswapRouter = new ethers.Contract(uniswapAdr, uniswapABI, wallet);

    const balance = await provider.getBalance(WALLET_ADDRESS);
    console.log("Connected to RPC");
    console.log(`Wallet Address: ${WALLET_ADDRESS}`);
    console.log(`ETH Balance: ${ethers.utils.formatEther(balance)}`);
};

const disconnect = () => {
    console.log("Disconnecting...");
    wallet = null;
    provider = null;
    uniswapRouter = null;
    console.log("Disconnected successfully");
};

// AMM Trading Function
// // Import environment variables
const MODE = process.env.MODE;  // "buy" or "sell"
const TOKEN1 = process.env.TOKEN1;
const TOKEN2 = process.env.TOKEN2;
const MAX_AMOUNT = parseInt(process.env.MAX_AMOUNT, 10); // Max amount in USD
const TIME_BETWEEN_ORDERS = parseInt(process.env.TIME_BETWEEN_ORDERS, 10); // Time between orders in minutes
const TOTAL_ORDERS = parseInt(process.env.TOTAL_ORDERS, 10); // Total number of orders

// Random Amount Function
const randomAmount = () => {
    return Math.random() * (MAX_AMOUNT - 1) + 1;  // Generates a random number between 1 and MAX_AMOUNT
};

// Updated AMMTrade function to use dynamic settings
const AMMTrade = async () => {
    console.log("Starting AMM Trade Operation");
    await connect();
    let result;

    try {
        console.log(`Trade Mode: ${MODE}`);
        const tradeFunction = MODE === 'buy' ? buyTokensCreateVolume : sellTokensCreateVolume;
        result = await tradeFunction(randomAmount());
        console.log(`Trade result: ${JSON.stringify(result)}`);
    } catch (error) {
        console.error("AMM Trade Operation failed", error);
        scheduleNext(new Date());
    } finally {
        await disconnect();
    }
};

// Update scheduler to handle dynamic interval
const scheduleNext = async (nextDate) => {
    // Apply delay
    await delay();

    // Set next job to be after TIME_BETWEEN_ORDERS minutes
    nextDate.setMinutes(nextDate.getMinutes() + TIME_BETWEEN_ORDERS);
    trades.nextTrade = nextDate.toString();
    console.log("Next Trade: ", nextDate);

    // Schedule next trade
    scheduler.scheduleJob(nextDate, AMMTrade);
    storeData();
};

// AMM Volume Trading Function
// Get minimum amount to trade
const getAmt = async (path) => {
    // Update max "i" as necessary
    for (let i = 1; i < 999; i++) {
        // Check how much we can get out of trading
        const amt = ethers.utils.parseEther("" + i.toFixed(1));
        const result = await uniswapRouter.getAmountsOut(amt, path);
        const expectedAmt = result[result.length - 1];
        const BUY_AMT = MIN_AMT * 5 + MIN_AMT * 2;

        // Check if traded amount is enough to cover BUY_AMT
        const amtOut = Number(ethers.utils.formatEther(expectedAmt));
        if (amtOut > BUY_AMT) {
            const dec = getRandomNum(4740217, 6530879);
            return i + "." + dec;
        }
    }
    return "99.9";
};

// Swaps Function (assumes 18 decimals on input amountIn)
const swapExactTokensForETH = async (amountIn, path) => {
    try {
        // Get amount out from uniswap router
        const amtInFormatted = ethers.utils.formatEther(amountIn);
        const result = await uniswapRouter.getAmountsOut(amountIn, path);
        const expectedAmt = result[result.length - 1];
        const deadline = Date.now() + 1000 * 60 * 8;

        // Calculate 10% slippage for ERC20 tokens
        const amountOutMin = expectedAmt - expectedAmt / 10n;
        const amountOut = ethers.utils.formatEther(amountOutMin);

        // Console log the details
        console.log("Swapping Tokens...");
        console.log("Amount In: " + amtInFormatted);
        console.log("Amount Out: " + amountOut);
        let swap;

        // Execute the swap using the appropriate function
        swap = await uniswapRouter.swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            WALLET_ADDRESS,
            deadline
        );

        // Wait for transaction to complete
        const receipt = await swap.wait();
        if (receipt) {
            console.log("TOKEN SWAP SUCCESSFUL");
            const transactionHash = receipt.hash;
            const t = explorer + transactionHash;

            // Return data
            const data = {
                type: "SELL",
                amountIn: amtInFormatted,
                amountOutMin: amountOut,
                path: path,
                wallet: WALLET_ADDRESS,
                transaction_url: t,
            };
            return data;
        }
    } catch (error) {
        console.error(error);
    }
    return false;
};

// AMM Volume Trading Function
const sellTokensCreateVolume = async (tries = 1.0) => {
    console.log(`Selling tokens, attempt #${tries}`);
    if (tries > 3) {
        console.log("Max retry attempts reached.");
        return false;
    }

    const path = [TOKEN2, TOKEN1];  // Adjusted for environment variables
    const amount = randomAmount();
    console.log(`Path: ${path.join(" -> ")}`);
    console.log(`Attempt to sell amount: ${amount}`);

    try {
        const result = await swapExactTokensForETH(ethers.utils.parseEther(amount.toString()), path);
        if (result) {
            console.log("Swap successful:", result);
            return result;
        } else {
            throw new Error("Swap failed with no result.");
        }
    } catch (error) {
        console.error("Swap failed:", error);
        return await sellTokensCreateVolume(tries + 1);
    }
};

const buyTokensCreateVolume = async (tries = 1.0) => {
    console.log(`Buying tokens, attempt #${tries}`);
    if (tries > 3) {
        console.log("Max retry attempts reached.");
        return false;
    }

    const path = [TOKEN1, TOKEN2];  // Adjusted for environment variables
    const amount = randomAmount();
    console.log(`Path: ${path.join(" -> ")}`);
    console.log(`Attempt to buy amount: ${amount}`);

    try {
        const result = await swapExactETHForTokens(ethers.utils.parseEther(amount.toString()), path);
        if (result) {
            console.log("Swap successful:", result);
            return result;
        } else {
            throw new Error("Swap failed with no result.");
        }
    } catch (error) {
        console.error("Swap failed:", error);
        return await buyTokensCreateVolume(tries + 1);
    }
};

// Swaps Function (assumes 18 decimals on input amountIn)
const swapExactETHForTokens = async (amountIn, path) => {
    try {
        // Get amount out from uniswap router
        const amtInFormatted = ethers.utils.formatEther(amountIn);
        const result = await uniswapRouter.getAmountsOut(amountIn, path);
        const expectedAmt = result[result.length - 1];
        const deadline = Date.now() + 1000 * 60 * 8;

        // Calculate 10% slippage for received ERC20 tokens
        const amountOutMin = expectedAmt - expectedAmt / 10n;
        const amountOut = ethers.utils.formatEther(amountOutMin);

        // Set transaction options
        const overrideOptions = {
            value: amountIn,
        };

        // Console log the details
        console.log("Swapping Tokens...");
        console.log("Amount In: " + amtInFormatted);
        console.log("Amount Out: " + amountOut);

        // Execute the transaction to exact ETH for tokens
        const swap = await uniswapRouter.swapExactETHForTokens(
            amountOutMin,
            path,
            WALLET_ADDRESS,
            deadline,
            overrideOptions
        );

        // Wait for transaction complete
        const receipt = await swap.wait();
        if (receipt) {
            console.log("TOKEN SWAP SUCCESSFUL");
            const transactionHash = receipt.hash;
            const t = explorer + transactionHash;

            // Return data
            const data = {
                type: "BUY",
                amountIn: amtInFormatted,
                amountOutMin: amountOut,
                path: path,
                wallet: WALLET_ADDRESS,
                transaction_url: t,
            };
            return data;
        }
    } catch (error) {
        console.error(error);
    }
    return false;
};

// Send Report Function
const sendReport = (report) => {
    // Get the formatted date
    const today = todayDate();
    console.log(report);
    // Configure email server
    const transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        secure: false,
        port: "587",
        tls: {
            ciphers: "SSLv3",
            rejectUnauthorized: false,
        },
        auth: {
            user: process.env.EMAIL_ADDR,
            pass: process.env.EMAIL_PW,
        },
    });
    // Setup mail params
    const mailOptions = {
        from: process.env.EMAIL_ADDR,
        to: process.env.RECIPIENT,
        subject: "Trade Report: " + today,
        text: JSON.stringify(report, null, 2),
    };
    // Send the email message
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log("Email sent: " + info.response);
        }
    });
};

// Current Date Function
const todayDate = () => {
    const today = new Date();
    return today.toLocaleString("en-GB", { timeZone: "Asia/Singapore" });
};

// Job Scheduler Function
// Data Storage Function
const storeData = async () => {
    const data = JSON.stringify(trades);
    fs.writeFile("./next.json", data, (err) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Data stored:\n", trades);
        }
    });
};

// Generate random num Function
const getRandomNum = (min, max) => {
    try {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    } catch (error) {
        console.error(error);
    }
    return max;
};

// Random Time Delay Function
const delay = () => {
    const ms = getRandomNum(2971, 4723);
    console.log(`delay(${ms})`);
    return new Promise((resolve) => setTimeout(resolve, ms));
};

main();
