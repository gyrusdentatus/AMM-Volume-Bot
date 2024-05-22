const { app, port } = require(".");

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

    // check if trades file exists
    if (!fs.existsSync("./next.json")) await storeData();

    // get stored values from file
    app.get('/', async (req, res) => {
      const addresses = JSON.parse(fs.readFileSync('addresses.json'));

      const balances = await Promise.all(addresses.map(async (walletInfo) => {
        const wallet = new ethers.Wallet(walletInfo.privateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        return {
          address: wallet.address,
          balance: ethers.utils.formatEther(balance),
        };
      }));

      res.render('dashboard', { balances });
    });

    app.listen(port, () => {
      console.log(`Dashboard running at http://localhost:${port}`);
    });


    // Import required node modules
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
    var report = [];
    var trades = {
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
    var wallet, provider, uniswapRouter;

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

        // check if trades file exists
        if (!fs.existsSync("./next.json")) await storeData();

        // get stored values from file
        const storedData = JSON.parse(fs.readFileSync("./next.json"));

        // not first launch, check data
        if ("nextTrade" in storedData) {
          const nextTrade = new Date(storedData.nextTrade);
          trades["count"] = new Number(storedData["count"]);
          console.log(`Current Count: ${trades["count"]}`);

          // restore trades schedule
          if (nextTrade > new Date()) {
            console.log("Restored Trade: " + nextTrade);
            scheduler.scheduleJob(nextTrade, AMMTrade);
            tradesExists = true;
          }
        }

        //no previous launch
        if (!tradesExists) {
          AMMTrade();
        }
      } catch (error) {
        console.error(error);
      }
    };

    // Ethers vars connect
    const connect = async () => {
      // new RPC connection
      provider = new JsonRpcProvider(RPC_URL);
      wallet = new ethers.Wallet(PRIV_KEY, provider);

      // uniswap router contract
      uniswapRouter = new ethers.Contract(uniswapAdr, uniswapABI, wallet);

      // connection established
      const balance = await provider.getBalance(WALLET_ADDRESS);
      console.log("ETH Balance:" + ethers.formatEther(balance));
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

        // store last traded, increase counter
        trades.previousTrade = today.toString();
        const t = trades["count"];
        trades["count"] = t + 1;

        // buy every 2nd iteration
        const buyTime = t % 2 == 0;

        // execute appropriate action based on condition
        if (buyTime) result = await buyTokensCreateVolume();
        else result = await sellTokensCreateVolume();

        // update on status
        report.push(result);
      } catch (error) {
        report.push("AMMTrade failed!");
        report.push(error);

        // try again later
        console.error(error);
        scheduleNext(new Date());
      }

      // send status update report
      report.push({ ...trades });
      sendReport(report);
      report = [];

      return disconnect();
    };

    // AMM Volume Trading Function
    const sellTokensCreateVolume = async (tries = 1) => {
      try {
        // limit to maximum 3 tries
        if (tries > 3) return false;
        console.log(`Try #${tries}...`);

        // prepare the variables needed for trade
        const path = [KTP, USDT, WETH];
        const amt = await getAmt(path);

        // execute the swap await result
        const a = ethers.parseEther(amt);
        const result = await swapExactTokensForETH(a, path);

        // succeeded
        if (result) {
          // get the remaining balance of the current wallet
          const u = await provider.getBalance(WALLET_ADDRESS);
          trades.previousTrade = new Date().toString();
          const balance = ethers.formatEther(u);
          console.log(`Balance:${balance} ETH`);
          await scheduleNext(new Date());

          // successful
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

        // fail, increment try count and retry again
        return await sellTokensCreateVolume(++tries);
      }
    };

    // Get minimum amount to trade
    const getAmt = async (path) => {
      // Update max "i"" as necessary
      for (let i = 1; i < 999; i++) {
        // check how much we can get out of trading
        const amt = ethers.parseEther("" + i.toFixed(1));
        const result = await uniswapRouter.getAmountsOut(amt, path);
        const expectedAmt = result[result.length - 1];
        const BUY_AMT = MIN_AMT * 5 + MIN_AMT * 2;

        // check if traded amount is enough to cover BUY_AMT
        const amtOut = Number(ethers.formatEther(expectedAmt));
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
        // get amount out from uniswap router
        const amtInFormatted = ethers.formatEther(amountIn);
        const result = await uniswapRouter.getAmountsOut(amountIn, path);
        const expectedAmt = result[result.length - 1];
        const deadline = Date.now() + 1000 * 60 * 8;

        // calculate 10% slippage for ERC20 tokens
        const amountOutMin = expectedAmt - expectedAmt / 10n;
        const amountOut = ethers.formatEther(amountOutMin);

        // console log the details
        console.log("Swapping Tokens...");
        console.log("Amount In: " + amtInFormatted);
        console.log("Amount Out: " + amountOut);
        let swap;

        // execute the swap using the appropriate function
        swap = await uniswapRouter.swapExactTokensForETH(
          amountIn,
          amountOutMin,
          path,
          WALLET_ADDRESS,
          deadline
        );

        // wait for transaction to complete
        const receipt = await swap.wait();
        if (receipt) {
          console.log("TOKEN SWAP SUCCESSFUL");
          const transactionHash = receipt.hash;
          const t = explorer + transactionHash;

          // return data
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
    const buyTokensCreateVolume = async (tries = 1) => {
      try {
        // limit to maximum 3 tries
        if (tries > 3) return false;
        console.log(`Try #${tries}...`);
        const BUY_AMT = MIN_AMT * 5;

        // prepare the variables needed for the trade
        const a = ethers.parseEther(BUY_AMT.toString());
        const path = [WETH, USDT, KTP];

        // execute the swap transaction and await result
        const result = await swapExactETHForTokens(a, path);

        // succeeded
        if (result) {
          // get the remaining balance of the current wallet
          const u = await provider.getBalance(WALLET_ADDRESS);
          trades.previousTrade = new Date().toString();
          const balance = ethers.formatEther(u);
          console.log(`Balance:${balance} ETH`);
          await scheduleNext(new Date());

          // successful
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

        // fail, increment try count and retry again
        return await buyTokensCreateVolume(++tries);
      }
    };

    // Swaps Function (assumes 18 decimals on input amountIn)
    const swapExactETHForTokens = async (amountIn, path) => {
      try {
        // get amount out from uniswap router
        const amtInFormatted = ethers.formatEther(amountIn);
        const result = await uniswapRouter.getAmountsOut(amountIn, path);
        const expectedAmt = result[result.length - 1];
        const deadline = Date.now() + 1000 * 60 * 8;

        // calculate 10% slippage for received ERC20 tokens
        const amountOutMin = expectedAmt - expectedAmt / 10n;
        const amountOut = ethers.formatEther(amountOutMin);

        // set transaction options
        const overrideOptions = {
          value: amountIn,
        };

        // console log the details
        console.log("Swapping Tokens...");
        console.log("Amount In: " + amtInFormatted);
        console.log("Amount Out: " + amountOut);

        // execute the transaction to exact ETH for tokens
        const swap = await uniswapRouter.swapExactETHForTokens(
          amountOutMin,
          path,
          WALLET_ADDRESS,
          deadline,
          overrideOptions
        );

        // wait for transaction complete
        const receipt = await swap.wait();
        if (receipt) {
          console.log("TOKEN SWAP SUCCESSFUL");
          const transactionHash = receipt.hash;
          const t = explorer + transactionHash;

          // return data
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
      // get the formatted date
      const today = todayDate();
      console.log(report);
      // configure email server
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
      // setup mail params
      const mailOptions = {
        from: process.env.EMAIL_ADDR,
        to: process.env.RECIPIENT,
        subject: "Trade Report: " + today,
        text: JSON.stringify(report, null, 2),
      };
      // send the email message
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
      // apply delay
      await delay();

      // set next job to be 12hrs from now
      nextDate.setHours(nextDate.getHours() + x);
      trades.nextTrade = nextDate.toString();
      console.log("Next Trade: ", nextDate);

      // schedule next restake
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

    main().catch(console.error);
  } finally { }
};
