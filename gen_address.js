const { ethers } = require('ethers');
const fs = require('fs');

const generateAddresses = (count) => {
    const addresses = [];
    for (let i = 0; i < count; i++) {
        const wallet = ethers.Wallet.createRandom();
        addresses.push({
            address: wallet.address,
            privateKey: wallet.privateKey,
        });
    }
    return addresses;
};

const addresses = generateAddresses(12);

// Save addresses to a file
fs.writeFileSync('addresses.json', JSON.stringify(addresses, null, 2));

console.log("Generated addresses and saved to addresses.json");
