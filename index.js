const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL;
const WALLET_ADDRESS = process.env.USER_ADDRESS;
const PRIV_KEY = process.env.USER_PRIVATE_KEY;
const uniswapABI = require("./ABI/uniswapABI");
const uniswapAdr = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const readline = require('readline');
const main = require('./main'); // Ensure main.js exports connect, AMMTrade, and checkBalance

// Ensure environment variables are set up before proceeding
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const showMenu = () => {
    console.log("\nAMM Trading System");
    console.log("1. Connect to Wallet");
    console.log("2. Execute Trade");
    console.log("3. Check Balance");
    console.log("4. Exit");

    rl.question("Choose an option: ", function(option) {
        switch (option) {
            case '1':
                main.connect()
                    .then(() => {
                        console.log("Connected Successfully!");
                        showMenu();
                    })
                    .catch(err => {
                        console.error("Connection Failed:", err);
                        showMenu();
                    });
                break;
            case '2':
                main.AMMTrade()
                    .then(() => {
                        console.log("Trade Executed Successfully!");
                        showMenu();
                    })
                    .catch(err => {
                        console.error("Trade Execution Failed:", err);
                        showMenu();
                    });
                break;
            case '3':
                main.checkBalance()
                    .then(balance => {
                        console.log(`Current Wallet Balance: ${balance}`);
                        showMenu();
                    })
                    .catch(err => {
                        console.error("Failed to Fetch Balance:", err);
                        showMenu();
                    });
                break;
            case '4':
                console.log("Exiting...");
                rl.close();
                break;
            default:
                console.log("Invalid option, please choose again.");
                showMenu();
        }
    });
};

rl.on('close', function() {
    console.log('\nGoodbye!');
    process.exit(0);
});

showMenu();

