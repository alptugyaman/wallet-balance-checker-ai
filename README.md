# Wallet Balance Checker

A simple web application to check ERC-20 token balances for any Ethereum wallet address.

## Demo

[Live Demo](https://676fb03bb0b774423d820e83--heroic-biscuit-92e520.netlify.app/)

## Features

- Check ETH and ERC-20 token balances
- Real-time price data from CoinGecko
- Filter tokens by minimum USD value
- Recent addresses history
- Responsive design

## Technologies

- React + TypeScript
- Vite
- Tailwind CSS
- Axios
- Moralis API
- CoinGecko API

## Setup

1. Clone the repository
```bash
git clone [repository-url]
cd wallet_balance
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with your API keys:
```env
VITE_MORALIS_API_KEY=your_moralis_api_key
VITE_COINGECKO_API_KEY=your_coingecko_api_key
```

4. Start the development server
```bash
npm run dev
```

## Usage

1. Enter an Ethereum wallet address
2. Click "Check Balance" to see the token balances
3. Use "Show all" to toggle between all tokens and tokens with value > $10
4. Recent addresses will be saved automatically

## License

MIT
