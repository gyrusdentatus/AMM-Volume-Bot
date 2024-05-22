const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL;
const WALLET_ADDRESS = process.env.USER_ADDRESS;
const PRIV_KEY = process.env.USER_PRIVATE_KEY;
const uniswapABI = require("./ABI/uniswapABI");
const uniswapAdr = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

// Check environment variables
if (!RPC_URL || !WALLET_ADDRESS || !PRIV_KEY) {
    console.error("Missing environment variables. Please check your .env file.");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIV_KEY, provider);
const uniswapRouter = new ethers.Contract(uniswapAdr, uniswapABI, wallet);

const checkConnection = async () => {
    try {
        const blockNumber = await provider.getBlockNumber();
        console.log("Connected to the provider. Current block number:", blockNumber);
    } catch (error) {
        console.error("Failed to connect to the provider:", error);
        process.exit(1);
    }
};

const checkBalance = async () => {
    try {
        const balance = await provider.getBalance(WALLET_ADDRESS);
        console.log("Wallet Balance:", ethers.utils.formatEther(balance), "ETH");
    } catch (error) {
        console.error("Error retrieving balance:", error);
        process.exit(1);
    }
};

const loadAddresses = () => {
    try {
        const addresses = JSON.parse(fs.readFileSync('addresses.json'));
        console.log("Addresses loaded:", addresses);
        return addresses;
    } catch (error) {
        console.error("Error loading addresses:", error);
        process.exit(1);
    }
};

const logTradeDetails = () => {
    console.log("\n--- Trade Details ---");
    console.log("RPC URL:", RPC_URL);
    console.log("Wallet Address:", WALLET_ADDRESS);
    console.log("Uniswap Router Address:", uniswapAdr);
    console.log("---------------------\n");
};

const main = async () => {
    console.log("Starting AMM Volume Bot Launcher...\n");

    await checkConnection();
    await checkBalance();
    const addresses = loadAddresses();
    logTradeDetails();

    console.log("Launching main bot...\n");

    // Import main bot script
    require('./main');
};

main();

