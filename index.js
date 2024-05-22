/*
- AMM Volume Bot - 
This is a simple AMM volumizer bot that automatically trades tokens on decentralized exchanges (DEX) so that price values are registered and available on a regular basis. Most DEX APIs will not update price data if there are no trades happening for more than a day. This bot aims to solve that problem by automatically executing a small trade at regular intervals. Prerequisite is that you will need to have some of your ERC20 tokens in your wallet, and you must first give token approval to the AMM router of the DEX for token spending. Once the bot is operational, it will sell tokens for the native coin every X hrs. All values are configurable in the code. :)  

Git: https://github.com/AzureKn1ght/AMM-Volume-Bot
*/


// Import required modules
const { ethers, JsonRpcProvider } = require("ethers");
const scheduler = require("node-schedule");
const nodemailer = require("nodemailer");
const figlet = require("figlet");
require("dotenv").config();
const fs = require("fs");

// Add the dashboard setup here
const express = require('express');
const app = express();
exports.app = app;
const port = 3000;
exports.port = port;

app.set('view engine', 'ejs');
app.use(express.static('public'));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

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
var wallet, uniswapRouter;

