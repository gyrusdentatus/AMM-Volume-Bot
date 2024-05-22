// Import required modules
const { ethers } = require("ethers");
const express = require("express");
const fs = require("fs");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

app.get("/", async (req, res) => {
    try {
        const addresses = JSON.parse(fs.readFileSync("addresses.json"));

        const balances = await Promise.all(
            addresses.map(async (walletInfo) => {
                const wallet = new ethers.Wallet(walletInfo.privateKey, provider);
                const balance = await provider.getBalance(wallet.address);
                return {
                    address: wallet.address,
                    balance: ethers.utils.formatEther(balance),
                };
            })
        );

        res.render("dashboard", { balances });
    } catch (error) {
        console.error("Error retrieving balances: ", error);
        res.status(500).send("Error retrieving balances. Please check the logs for more details.");
    }
});

app.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
});

module.exports = app; // Export app for potential testing or further integration
