// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./SpaceCoin.sol";

/// @title A Liquidity Pool for the SpaceCoin Project
/// @author Michael Azorin
contract SpaceCoinLP is ERC20 {
    uint256 public k; //k set at pool seed. k*totalSupply gives updated moving k value
    
    uint256 public ethTotal; 
    uint256 public spcTotal;

    SpaceCoin public immutable spaceCoin;

    event Mint(address recipient, uint amountETH, uint amountSPC);
    event Burn(address recipient, uint amountETH, uint amountSPC);
    event SwapSPC(address recipient, uint amountIn, uint amountOut);
    event SwapETH(address recipient, uint amountIn, uint amountOut);

    //create the LP token in the constructor
    constructor(address _tokenAddress) ERC20("SpaceCoinLP", "SPC-ETH LP") { 
        //tokenAddress = _tokenAddress;
        spaceCoin = SpaceCoin(_tokenAddress);
    }

    receive() external payable {
        //yes i can passively receive eth :>
    }

    //aka "spot price"
    //also useful for determining perfectly matched liquidity for providers
    function idealQuote(uint256 amountIn, bool swapDirection) public view returns (uint amountOut) {
        if (swapDirection) { 
            //for true: amountIn = spcIn, amountOut = ethInBalanced
            return amountIn * ethTotal / spcTotal;
        } else { //for false: amountIn = ethIn, amountOut = spcInBalanced
            return amountIn * spcTotal / ethTotal;
        }
    }

    function mint(address _recipient) external returns (uint lpTokensToMint) {
        //Has this contract received ETH/SPC since last LP token minting? 
        // This is nice because it auto-accounts for any transfer tax
        uint256 ethBalance = address(this).balance;
        uint256 spcBalance = spaceCoin.balanceOf(address(this));

        uint256 ethAdded = ethBalance - ethTotal;
        uint256 spcAdded = spcBalance - spcTotal;

        require (ethAdded != 0 && spcAdded != 0, "must add SPC + ETH");

        uint256 _totalSupply = totalSupply();
        //do something special if balance is zero. initialize the pool..
        if (_totalSupply == 0) {
            ethTotal = ethAdded;
            spcTotal = spcAdded;
            lpTokensToMint = 1 ether; //we're doing it this way. 1 LP token = 100% of the pool at inception. 
            k = ethAdded * spcAdded / lpTokensToMint;   //k value = totalSupply * k 

            _mint(_recipient, lpTokensToMint); 
            emit Mint(_recipient, ethAdded, spcAdded);
            return lpTokensToMint;
        } else {
            lpTokensToMint = ethAdded * _totalSupply / ethTotal;
            uint256 amountToMintSPC = spcAdded * _totalSupply / spcTotal;
            if (lpTokensToMint > amountToMintSPC) {lpTokensToMint = amountToMintSPC;}

            //update totals-- but only up to balanced amount
            //remember lpTokensToMint is the MIN of both added values
            //any /extra/ spc or eth sent will sit "on top" of the contract and not be reflected in reserves
            ethTotal += lpTokensToMint * ethTotal / _totalSupply;
            spcTotal += lpTokensToMint * spcTotal / _totalSupply;

            k = (ethTotal * spcTotal) / (_totalSupply + lpTokensToMint);

            _mint(_recipient, lpTokensToMint);
            emit Mint(_recipient, ethAdded, spcAdded);
            return lpTokensToMint;
        }
    }

    function burn(address _recipient) external returns (uint256 ethToSend, uint256 spcToSend) {
        uint256 lpTokensToBurn = balanceOf(address(this));
        require (lpTokensToBurn !=0, "no LP tokens to burn");
        uint256 ethBalance = address(this).balance;
        uint256 spcBalance = spaceCoin.balanceOf(address(this));

        uint256 _totalSupply = totalSupply();
        ethToSend = lpTokensToBurn * ethBalance / _totalSupply;
        spcToSend = lpTokensToBurn * spcBalance / _totalSupply;

        //update totals
        ethTotal -= ethToSend;
        spcTotal -= spcToSend;

        //update k.. if we dare >:)
        if (_totalSupply != lpTokensToBurn) {
            k = (ethTotal * spcTotal) / (_totalSupply - lpTokensToBurn);
        } else {
            k = 0;
        }

        _burn(address(this), lpTokensToBurn);
        emit Burn(_recipient, ethToSend, spcToSend);
        (bool sent, ) = _recipient.call{value: ethToSend}("");
        require(sent, "Failed to send Ether");
        bool success = spaceCoin.transfer(_recipient, spcToSend);
        require (success, "SPC transfer failed");

        return (ethToSend, spcToSend);
    }

    function swapTokenForEth(address _recipient) external returns (uint256 ethToSend) {
        //check how much token has been passed to the LP
        uint256 spcBalance = spaceCoin.balanceOf(address(this));
        uint256 spcAdded = spcBalance - spcTotal;
        require (spcAdded > 0, "you gotta give me some SPC to swap");

        ethToSend = quoteTokenForEth(spcAdded);

        //update totals
        spcTotal += spcAdded;
        ethTotal -= ethToSend; 

        //update K
        k = ethTotal * spcTotal / totalSupply();

        //    event SwapSPC(address recipient, uint amountIn, uint amountOut);
        emit SwapSPC(_recipient,spcAdded,ethToSend);
        (bool sent, ) = _recipient.call{value: ethToSend}("");
        require(sent, "Failed to send Ether");

        return ethToSend;
    }

    function quoteTokenForEth(uint256 spcAdded) public view returns (uint256 ethToSend) {
        uint256 _totalSupply = totalSupply(); //this is our K.
        uint256 spcAddedFee = spcAdded / 100;
        uint256 y = k * _totalSupply / (spcTotal + spcAdded - spcAddedFee);
        ethToSend = ethTotal - y;
        return ethToSend;
    }

    function swapEthForToken(address _recipient) external returns (uint256 spcToSend) {
        //check how much token has been passed to the LP
        uint256 ethBalance = address(this).balance;
        uint256 ethAdded = ethBalance - ethTotal;
        require (ethAdded > 0, "you gotta give me some ETH to swap");

        spcToSend = quoteEthForToken(ethAdded);

        //update totals
        ethTotal += ethAdded;
        spcTotal -= spcToSend;

        //update K
        k = ethTotal * spcTotal / totalSupply();

        bool success = spaceCoin.transfer(_recipient, spcToSend);
        require (success, "SPC transfer failed");

        //If token transfer tax on, return spcToSend as spc minus transfer tax
        if (!spaceCoin.transferTaxOn()) {
            emit SwapETH(_recipient, ethAdded, spcToSend);
            return spcToSend;
        } else {
            uint256 transferTax = spcToSend * 2 / 100;
            emit SwapETH(_recipient, ethAdded, spcToSend - transferTax);
            return (spcToSend - transferTax);
        }
    }

    function quoteEthForToken(uint256 ethAdded) public view returns (uint256 spcToSend) {
        uint256 _totalSupply = totalSupply(); //this is our K.
        uint256 ethAddedFee = ethAdded / 100;
        uint256 y = k * _totalSupply / (ethTotal + ethAdded - ethAddedFee);
        spcToSend = spcTotal - y;
        return spcToSend;
    }

    //function skim - useful when transfer tax breaks LP add liq calcs
    function skim(address _recipient) external {
        uint256 ethToSend = address(this).balance - ethTotal;
        if (ethToSend != 0) {
            (bool sent, ) = _recipient.call{value: ethToSend}("");
            require(sent, "Failed to send Ether");
        }

        uint256 spcToSend = spaceCoin.balanceOf(address(this)) - spcTotal;
        if (spcToSend != 0) {
            bool success = spaceCoin.transfer(_recipient, spcToSend);
            require (success, "SPC transfer failed");           
        }
    }
}

contract SpaceRouter {
    address payable public immutable lpTokenAddress;
    SpaceCoin public immutable spaceCoin;
    SpaceCoinLP public immutable lpContract;

    constructor (address _tokenAddress, address _lpTokenAddress) {
        lpTokenAddress = payable(_lpTokenAddress);
        lpContract = SpaceCoinLP(lpTokenAddress);
        spaceCoin = SpaceCoin(_tokenAddress);
    }

    function addLiquidity(uint256 amountSpcIn, uint256 amountSpcMin, uint256 amountEthMin) external payable {
        uint256 amountSpcToAdd;
        uint256 amountEthToAdd;
        uint256 amountEthBalanced;

        if (lpContract.totalSupply() != 0) {
            //check the quote
            //for true: amountIn = spcIn, amountOut = ethInBalanced
            //if spctransfertax on, adjust the amountethbalanced
            if (!spaceCoin.transferTaxOn()) {
                amountEthBalanced = lpContract.idealQuote(amountSpcIn, true);
            } else {
                uint256 transferTax = amountSpcIn * 2 / 100;
                amountEthBalanced = lpContract.idealQuote(amountSpcIn - transferTax, true);
            }

            if (amountEthBalanced < msg.value) {
            //for false: amountIn = ethIn, amountOut = spcInBalanced
                amountSpcToAdd = amountSpcIn;
                amountEthToAdd = amountEthBalanced;
            } else {
                uint256 amountSpcBalanced = lpContract.idealQuote(msg.value, false);
                amountSpcToAdd = amountSpcBalanced;
                amountEthToAdd = msg.value;
            }

            //revert if slipped
            require(amountSpcToAdd >= amountSpcMin, "SpaceRouter: INSUFFICIENT_SPC_AMOUNT");
            require(amountEthToAdd >= amountEthMin, "SpaceRouter: INSUFFICIENT_ETH_AMOUNT");
        } else {
            amountEthToAdd = msg.value;
            amountSpcToAdd = amountSpcIn;
        }

        //send the coins 
        bool success = spaceCoin.transferFrom(msg.sender, lpTokenAddress, amountSpcToAdd);
        require (success, "could not transfer SPC");         
        (bool sent, ) = lpTokenAddress.call{value: amountEthToAdd}("");
        require(sent, "Failed to send Ether");

        lpContract.mint(msg.sender);

        //Force reserves to equal balances
        lpContract.skim(msg.sender);

        //Send any excess ETH stuck in the router back to the user
        uint256 routerEthBalance = address(this).balance;
        if (routerEthBalance !=0) {
            (bool sentBack, ) = msg.sender.call{value: routerEthBalance}("");
            require(sentBack, "Failed to send Ether");            
        }
    }

    function removeLiquidity(uint256 _lpTokensToBurn) external {
        //Not adding any slippage controls here. If the ratio moves, it moves.
        bool success = lpContract.transferFrom(msg.sender, lpTokenAddress, _lpTokensToBurn);
        require (success, "could not transfer SPC-ETH LP"); 
        lpContract.burn(msg.sender);
    }

    function swapExactTokenForEth(uint256 amountIn, uint256 amountOutMin) external {
        bool success = spaceCoin.transferFrom(msg.sender, lpTokenAddress, amountIn);
        require (success, "could not transfer SPC"); 
        uint amountOut = lpContract.swapTokenForEth(msg.sender);
        require (amountOut >= amountOutMin, "SpaceRouter: INSUFFICIENT_OUTPUT_AMOUNT");
    }

    function swapExactEthForToken(uint256 amountOutMin) external payable {
        (bool sent, ) = lpTokenAddress.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
        uint amountOut = lpContract.swapEthForToken(msg.sender);
        require (amountOut >= amountOutMin, "SpaceRouter: INSUFFICIENT_OUTPUT_AMOUNT");
    }
}