# AMM Volume Bot

This is a simple AMM volumizer bot that automatically trades tokens on decentralized exchanges (DEX) so that price values are registered and available on a regular basis. Most DEX APIs will not update price data if there are no trades happening for more than a day. This bot aims to solve that problem by automatically executing a small trade at regular intervals. 

## Prerequisites

- Node.js
- Docker
- Docker Compose

## Installation

1. **Clone the repository:**

    ```sh
    git clone https://github.com/AzureKn1ght/AMM-Volume-Bot.git
    cd AMM-Volume-Bot
    ```

2. **Set up the environment variables:**

    Create a `.env` file in the root directory and fill in the required values:

    ```sh
    RPC_URL="https://base.llamarpc.com"
    USER_ADDRESS="your_wallet_address"
    USER_PRIVATE_KEY="your_private_key"
    EMAIL_ADDR="your_email_address"
    EMAIL_PW="your_email_password"
    RECIPIENT="recipient_email_address"
    ```

3. **Install dependencies:**

    If you are running the bot without Docker, you need to install the dependencies:

    ```sh
    npm install
    ```

## Running the Bot

### Running Locally

1. **Run the bot:**

    ```sh
    node main.js
    ```

### Running with Docker

1. **Build the Docker image:**

    ```sh
    docker build -t amm-volume-bot .
    ```

2. **Create a Docker Compose file:**

    Create a `docker-compose.yml` file in the root directory with the following content:

    ```yaml
    version: '3.8'

    services:
      app:
        build: .
        container_name: amm_volume_bot
        env_file:
          - .env
        volumes:
          - .:/usr/src/app
          - /usr/src/app/node_modules
        restart: always
    ```

3. **Run the Docker container:**

    ```sh
    docker-compose up -d
    ```

4. **Check logs:**

    To view the logs of the running bot:

    ```sh
    docker-compose logs -f
    ```

## Project Structure

- **index.js:** Contains the main logic of the bot.
- **ABI/uniswapABI.js:** Contains the ABI required for interacting with the Uniswap router.
- **next.json:** Stores the state of the next scheduled trade.
- **Dockerfile:** Docker configuration for building the image.
- **docker-compose.yml:** Docker Compose configuration for running the bot.

## Troubleshooting

- **Provider Connection Issues:** Ensure your `RPC_URL` is correct and the provider is responsive.
- **Insufficient Funds:** Make sure the wallet address specified in `USER_ADDRESS` has sufficient funds to execute trades.
- **Permission Issues:** Ensure the private key provided has the necessary permissions for trading.

## License

This project is licensed under the IDONTGIVEAFUCK License. See the LICENSE file for details.



