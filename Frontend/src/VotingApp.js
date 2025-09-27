import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import VotingABI from './Voting.json'; // ABI from Truffle build
import Chart from 'chart.js/auto';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css'; // For icons

const CONTRACT_ADDRESS = '0xD93E8A306a1f56a8E713e017ebb72A8D4Ac5d6FB'.trim(); // Update with your address
const NETWORK_ID = 1337; // Ganache default

function VotingApp() {
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [votes, setVotes] = useState({ 0: 0, 1: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chartInstance, setChartInstance] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [eventListener, setEventListener] = useState(null);

  const loadBlockchainData = async () => {
    if (!contract || !account) {
      console.log('No contract or account, skipping load');
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    console.log('Starting data load for account:', account);
    try {
      const candidatesCount = await contract.methods.getCandidatesCount().call();
      console.log('Candidates count:', candidatesCount);
      if (candidatesCount !== 2) console.warn('Unexpected candidate count:', candidatesCount);
      const newVotes = { 0: 0, 1: 0 };
      for (let i = 0; i < candidatesCount; i++) {
        newVotes[i] = parseInt(await contract.methods.getCandidateVotes(i).call());
      }
      setVotes(newVotes);
      console.log('Loaded votes:', newVotes);

      const userVoted = await contract.methods.hasVoted(account).call();
      console.log('Has voted status for', account, ':', userVoted);
      setHasVoted(userVoted);

      updateChart(newVotes);
    } catch (error) {
      console.error('Error in loadBlockchainData for', account, ':', error);
      alert('Error loading blockchain data: ' + (error.message || 'Unknown error'));
      try {
        const candidatesCount = await contract.methods.getCandidatesCount().call();
        const newVotes = { 0: 0, 1: 0 };
        for (let i = 0; i < candidatesCount; i++) {
          newVotes[i] = parseInt(await contract.methods.getCandidateVotes(i).call());
        }
        setVotes(newVotes);
        updateChart(newVotes);
      } catch (loadError) {
        console.error('Failed to load public votes:', loadError);
      }
    } finally {
      console.log('Data load completed for', account);
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (contract && account) {
      loadBlockchainData();
    }
  }, [contract, account]);

  const updateChart = (votesData) => {
    if (chartInstance) {
      chartInstance.destroy();
    }
    const totalVotes = votesData[0] + votesData[1];
    const percentages = [
      totalVotes ? (votesData[0] / totalVotes * 100).toFixed(1) : 0,
      totalVotes ? (votesData[1] / totalVotes * 100).toFixed(1) : 0
    ];

    const ctx = document.getElementById('voteChart').getContext('2d');
    const newChartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Candidate 1', 'Candidate 2'],
        datasets: [{
          data: [votesData[0], votesData[1]],
          backgroundColor: ['#FF6B6B', '#4ECDC4'],
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 14 }, color: '#333' } },
          title: { display: true, text: 'Voting Results', font: { size: 18 }, color: '#2C3E50' },
          tooltip: { callbacks: { label: (tooltipItem) => `${tooltipItem.label}: ${percentages[tooltipItem.dataIndex]}%` } }
        },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });
    setChartInstance(newChartInstance);
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (parseInt(chainId, 16) !== NETWORK_ID) {
          alert(`Switch to Ganache (Chain ID ${NETWORK_ID}).`);
          return;
        }
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);

        const accounts = await web3Instance.eth.getAccounts();
        setAccount(accounts[0]);
        setIsConnected(true);

        const votingContract = new web3Instance.eth.Contract(VotingABI.abi, CONTRACT_ADDRESS);
        setContract(votingContract);

        const listener = votingContract.events.Voted({ fromBlock: 0 }, async (error, event) => {
          if (error) console.error('Event error:', error);
          else {
            console.log('Vote event received:', event);
            await loadBlockchainData();
          }
        });
        listener.on('error', console.error);
        setEventListener(listener);

        window.ethereum.on('accountsChanged', async (accounts) => {
          if (accounts.length === 0) {
            setIsConnected(false);
            setAccount('');
            setHasVoted(false);
            setVotes({ 0: 0, 1: 0 });
            if (chartInstance) {
              chartInstance.destroy();
              setChartInstance(null);
            }
          } else {
            setAccount(accounts[0]);
          }
        });
      } catch (error) {
        console.error('Connection failed:', error);
        alert('Connection failed: ' + error.message);
      }
    } else alert('MetaMask not detected.');
  };

  const disconnectWallet = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
        setIsConnected(false);
        setAccount('');
        setContract(null);
        setVotes({ 0: 0, 1: 0 });
        setWeb3(null);
        setHasVoted(false);
        if (chartInstance) {
          chartInstance.destroy();
          setChartInstance(null);
        }
        if (eventListener) {
          eventListener.off();
          setEventListener(null);
        }
      } catch (error) {
        console.error('Disconnect failed:', error);
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      if (window.ethereum && window.ethereum.selectedAddress) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (parseInt(chainId, 16) === NETWORK_ID) {
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);
          setAccount(window.ethereum.selectedAddress);
          setIsConnected(true);

          const votingContract = new web3Instance.eth.Contract(VotingABI.abi, CONTRACT_ADDRESS);
          setContract(votingContract);

          const listener = votingContract.events.Voted({ fromBlock: 0 }, async (error, event) => {
            if (error) console.error('Event error:', error);
            else {
              console.log('Vote event received:', event);
              await loadBlockchainData();
            }
          });
          listener.on('error', console.error);
          setEventListener(listener);

          window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length === 0) {
              setIsConnected(false);
              setAccount('');
              setHasVoted(false);
              setVotes({ 0: 0, 1: 0 });
              if (chartInstance) {
                chartInstance.destroy();
                setChartInstance(null);
              }
            } else {
              setAccount(accounts[0]);
            }
          });
        }
      }
    };
    init();
  }, []);

  const handleVote = async (candidateIndex) => {
    if (!contract || !account || hasVoted || loadingData) {
      alert('Cannot vote: Not connected, already voted, or loading data.');
      return;
    }
    try {
      console.log('Voting for:', candidateIndex, 'with', account);
      await contract.methods.vote(candidateIndex).send({ from: account, gas: 400000 });
      setHasVoted(true);
      await loadBlockchainData();
    } catch (error) {
      console.error('Vote failed for', account, ':', error);
      let errorMsg = 'Vote failed. Check contract or gas.';
      if (error.message.includes('Internal JSON-RPC error') || error.message.includes('revert')) {
        const revertData = error.data?.message || error.message;
        if (revertData.includes('already voted') || revertData.includes('You have already voted')) {
          setHasVoted(true);
          errorMsg = 'You have already voted. Cannot vote again.';
        } else if (revertData.includes('Invalid candidate')) {
          errorMsg = 'Invalid candidate selected.';
        } else if (revertData.includes('out of gas')) {
          errorMsg = 'Insufficient gas. Please increase the gas limit.';
        } else {
          errorMsg += ' Insufficient gas or contract issue.';
        }
      }
      alert(errorMsg);
      await loadBlockchainData();
    }
  };

  return (
    <div className="vh-100 d-flex flex-column bg-light">
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div className="container-fluid">
          <a className="navbar-brand text-warning fw-bold" href="#">
            <i className="bi bi-shield-lock-fill"></i> Decentralized Voting
          </a>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse justify-content-end" id="navbarNav">
            <ul className="navbar-nav">
              <li className="nav-item">
                {isConnected ? (
                  <button className="btn btn-outline-danger nav-link" onClick={disconnectWallet}>
                    <i className="bi bi-box-arrow-right"></i> Disconnect
                  </button>
                ) : (
                  <button className="btn btn-outline-primary nav-link" onClick={connectWallet}>
                    <i className="bi bi-wallet2"></i> Connect Wallet
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container my-4 flex-grow-1 d-flex align-items-center justify-content-center">
        {isConnected ? (
          <div className="row g-4 w-100">
            <div className="col-md-6">
              <div className="card border-0 shadow-lg bg-white rounded-4">
                <div className="card-body p-5">
                  <h2 className="card-title text-success fw-bold mb-4">Cast Your Vote</h2>
                  <p className="text-muted mb-4">Choose your candidate:</p>
                  <button
                    className="btn btn-outline-success w-100 mb-3 py-3 text-start"
                    onClick={() => handleVote(0)}
                    disabled={hasVoted || loadingData}
                  >
                    <i className="bi bi-person-check-fill me-2"></i> Candidate 1 ({votes[0]} votes)
                  </button>
                  <button
                    className="btn btn-outline-success w-100 py-3 text-start"
                    onClick={() => handleVote(1)}
                    disabled={hasVoted || loadingData}
                  >
                    <i className="bi bi-person-check-fill me-2"></i> Candidate 2 ({votes[1]} votes)
                  </button>
                  {hasVoted && (
                    <p className="text-danger mt-3 fw-bold">
                      <i className="bi bi-exclamation-triangle-fill"></i> You have already voted!
                    </p>
                  )}
                  {loadingData && (
                    <p className="text-info mt-3">
                      <i className="bi bi-hourglass-split"></i> Loading voting status...
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card border-0 shadow-lg bg-white rounded-4">
                <div className="card-body p-5">
                  <h2 className="card-title text-info fw-bold mb-4">Election Results</h2>
                  <div className="ratio ratio-1x1">
                    <canvas id="voteChart"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-dark">
            <h1 className="display-4 mb-4">Welcome to Decentralized Voting</h1>
            <p className="lead mb-4">Please connect your wallet to participate.</p>
            <p className="text-muted">Use Ganache accounts only. Reset with redeploy.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-dark text-white text-center py-4">
        <p className="mb-0">&copy; 2025 Decentralized Voting. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default VotingApp;