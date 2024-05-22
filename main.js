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
    // New RPC connection
    provider = new JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(PRIV_KEY, provider);

    // Uniswap router contract
    uniswapRouter = new ethers.Contract(uniswapAdr, uniswapABI, wallet);

    // Connection established
    const balance = await provider.getBalance(WALLET_ADDRESS);
    console.log("ETH Balance:" + ethers.utils.formatEther(balance));
    console.log("--> connected\n");
};

// Ethers vars disconnect
const disconnect = () => {
    wallet = null;
    provider = null;
    uniswapRouter = null;
    console.log("-disconnected-\n");
};

// AMM Trading Function
const AMMTrade = async () => {
    console.log("\n--- AMMTrade Start ---");
    report.push("--- AMMTrade Report ---");
    report.push(`By: ${WALLET_ADDRESS}`);
    try {
        const today = new Date();
        await connect();
        let result;

        // Store last traded, increase counter
        trades.previousTrade = today.toString();
        const t = trades["count"];
        trades["count"] = t + 1;

        // Buy every 2nd iteration
        const buyTime = t % 2 === 0;

        // Execute appropriate action based on condition
        if (buyTime) result = await buyTokensCreateVolume();
        else result = await sellTokensCreateVolume();

        // Update on status
        report.push(result);
    } catch (error) {
        report.push("AMMTrade failed!");
        report.push(error);

        // Try again later
        console.error(error);
        scheduleNext(new Date());
    }

    // Send status update report
    report.push({ ...trades });
    sendReport(report);
    report = [];

    return disconnect();
};

// AMM Volume Trading Function
const sellTokensCreateVolume = async (tries = 1.0) => {
    try {
        // Limit to maximum 3 tries
        if (tries > 3) return false;
        console.log(`Try #${tries}...`);

        // Prepare the variables needed for trade
        const path = [KTP, USDT, WETH];
        const amt = await getAmt(path);

        // Execute the swap await result
        const a = ethers.utils.parseEther(amt);
        const result = await swapExactTokensForETH(a, path);

        // Succeeded
        if (result) {
            // Get the remaining balance of the current wallet
            const u = await provider.getBalance(WALLET_ADDRESS);
            trades.previousTrade = new Date().toString();
            const balance = ethers.utils.formatEther(u);
            console.log(`Balance:${balance} ETH`);
            await scheduleNext(new Date());

            // Successful
            const success = {
                balance: balance,
                success: true,
                trade: result,
            };

            return success;
        } else throw new Error();
    } catch (error) {
        console.log("Attempt Failed!");
        console.log("retrying...");
        console.error(error);

        // Fail, increment try count and retry again
        return await sellTokensCreateVolume(++tries);
    }
};

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
const buyTokensCreateVolume = async (tries = 1.0) => {
    try {
        // Limit to maximum 3 tries
        if (tries > 3) return false;
        console.log(`Try #${tries}...`);
        const BUY_AMT = MIN_AMT * 5;

        // Prepare the variables needed for the trade
        const a = ethers.utils.parseEther(BUY_AMT.toString());
        const path = [WETH, USDT, KTP];

        // Execute the swap transaction and await result
        const result = await swapExactETHForTokens(a, path);

        // Succeeded
        if (result) {
            // Get the remaining balance of the current wallet
            const u = await provider.getBalance(WALLET_ADDRESS);
            trades.previousTrade = new Date().toString();
            const balance = ethers.utils.formatEther(u);
            console.log(`Balance:${balance} ETH`);
            await scheduleNext(new Date());

            // Successful
            const success = {
                balance: balance,
                success: true,
                trade: result,
            };

            return success;
        } else throw new Error();
    } catch (error) {
        console.log("Attempt Failed!");
        console.log("retrying...");
        console.error(error);

        // Fail, increment try count and retry again
        return await buyTokensCreateVolume(++tries);
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
const scheduleNext = async (nextDate) => {
    // Apply delay
    await delay();

    // Set next job to be 12hrs from now
    nextDate.setHours(nextDate.getHours() + x);
    trades.nextTrade = nextDate.toString();
    console.log("Next Trade: ", nextDate);

    // Schedule next restake
    scheduler.scheduleJob(nextDate, AMMTrade);
    storeData();
    return;
};

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
