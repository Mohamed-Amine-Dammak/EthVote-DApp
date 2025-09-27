module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (Ganache default)
      port: 7545,            // Ganache default port
      network_id: "*",       // Any network ID
    },
  },
  compilers: {
    solc: {
      version: "0.8.19",    // Matches the PDF's Solidity version
    },
  },
};