import { Component, OnInit, ViewChild, ɵRender3NgModuleRef } from '@angular/core';

import { PinNumberModal } from '../../../shared/modals/pin-number/pin-number.modal';
import { Wallet } from '../../../../models/wallet';
import { StorageService } from '../../../../services/storage.service';
import { ApiService } from '../../../../services/api.service';
import { Web3Service } from '../../../../services/web3.service';
import { UtilService } from '../../../../services/util.service';
import { CoinService } from '../../../../services/coin.service';
import { AlertService } from '../../../../services/alert.service';
import * as Btc from 'bitcoinjs-lib';
import { KanbanService } from '../../../../services/kanban.service';
import { MyCoin } from '../../../../models/mycoin';
import {environment} from '../../../../../environments/environment';
import { TransactionResp } from '../../../../interfaces/kanban.interface';
import Common from 'ethereumjs-common';
import * as Eth from 'ethereumjs-tx';
import BigNumber from 'bignumber.js';

@Component({
  selector: 'app-smart-contract',
  templateUrl: './smart-contract.component.html',
  styleUrls: ['./smart-contract.component.css']
})
export class SmartContractComponent implements OnInit {
  @ViewChild('pinModal', {static: true}) pinModal: PinNumberModal;
  method: any;
  action: string;
  abiName: string;
  txid: string;
  txHex: string;
  customAbi: string;
  contractName: string;
  smartContractName: string;
  currentTabIndex: number;
  result: string;
  error: string;
  newSmartContractAddress: string;
  fabABI: string;
  fabBytecode: string;
  fabArguments: string;

  ethABI: string;
  ethBytecode: string;
  ethArguments: string;  

  kanbanABI: string;
  kanbanBytecode: string;
  kanbanArguments: string;

  _kanbanCallABI: string;
  _kanbanCallArgs: any;

  get kanbanCallABI(): string {
    return this._kanbanCallABI;
  }

  set kanbanCallABI(val: string) {
    this._kanbanCallABI = val;
    this.formAbiHex();
  }

  formAbiHex() {
    try {
      const abiDoubleQuote = this._kanbanCallABI.replace(/'/g, '"');
      const abi = JSON.parse(abiDoubleQuote);
      let args: any = [];
      if (this._kanbanCallArgs.length > 0) {
        this._kanbanCallArgs.forEach(input => {
          let jsonObj = input.value;
          try {
            jsonObj = JSON.parse(jsonObj);
          } catch (e) {}
          if(typeof jsonObj === 'number') {
            jsonObj = '0x' + new BigNumber(jsonObj).toString(16)
          }
          args.push(jsonObj);
        });
      }
      this.kanbanData = this.web3Serv.getGeneralFunctionABI(abi, args);
    } catch(e) {}
  }
  
  ethData: string;
  lockerHashes: any;
  kanbanTo: string;
  gasPrice: number;
  gasLimit: number;
  kanbanValue: number;
  kanbanData: string;
  payableValue: number;
  selectedMethod: string;
  types: any = [];
  wallet: Wallet | null;
  smartContractAddress: string;
  mycoin: MyCoin;
  ethCoin: MyCoin;
  exgCoin: MyCoin;
  balance: any;
  ethBalance: any;
  contractNames = [
    'Lock FAB or EXG for SEED airdrop',
    'EXG',
    'DSC',
    'BST',
    'Fab Lock For EXG Airdrop',
    'Custom'
  ];
  ABI: any = [];
  constructor(
    private storageService: StorageService, 
    private apiServ: ApiService, 
    private web3Serv: Web3Service,
    private utilServ: UtilService,
    private coinServ: CoinService,
    private kanbanServ: KanbanService,
    private alertServ: AlertService
    ) { 
    // this.ABI = this.getFunctionABI(this.ABI);
  }

  changeContractName(name:string) {
    console.log('change contract name:', name);
    this.contractName=name;
    if(name === 'Fab Lock For EXG Airdrop') {
      this.smartContractAddress =  environment.addresses.smartContract.FABLOCK;
    } else
    if(name === 'Lock FAB or EXG for SEED airdrop') {
      this.smartContractAddress =  environment.addresses.smartContract.StakingFABEXG;
    } else
    if(name === 'Custom') {
      this.smartContractAddress = '';
    } else {
      this.smartContractAddress = environment.addresses.smartContract[name].FAB;
    }

    this.changeSmartContractAddress();
  }

  changeSmartContractAddress() {

    if(this.smartContractAddress === '0x0' || this.smartContractAddress === '0x' || !this.smartContractAddress) {
      this.changeMethod('');
    } else {
      this.apiServ.getSmartContractABI(this.smartContractAddress).subscribe((res: any) => {
        if (res && res.abi) {
          this.ABI = this.getFunctionABI(res.abi);
          if(this.ABI && this.ABI.length > 0) {
            if(this.smartContractAddress == environment.addresses.smartContract.EXG.FAB) {
              this.changeMethod('unlockByLockerHash');
            } else {
              this.changeMethod(this.ABI[0].name);
            }
            
          }
        }

      });      
    }
  }

  formTypes(abi) {
    for (let j = 0; j < abi.inputs.length; j ++) {
      const input = abi.inputs[j];
      const type: any = input.type;
      if (this.types.includes(type)) {
        continue;
      }
      this.types.push(type);
    }
  }

  getFunctionABI(ABI: any) {
    const retABI = ABI.filter((abi) => abi.type === 'function');
    for (let i = 0; i < retABI.length; i++) {
      const item = retABI[i];
      this.formTypes(item);
    }
    return retABI;
  }

  tabChanged(event) {
    console.log('event=', event);
    this.currentTabIndex = event.index;
  }

  async ngOnInit() {
    this.currentTabIndex = 0;
    this.action = '';
    this.lockerHashes = [];
    this.gasLimit = 1000000;
    this.gasPrice = 50;    
    this.kanbanValue = 0;
    //this.smartContractAddress = environment.addresses.smartContract.FABLOCK;
    //this.changeSmartContractAddress();
    this.wallet = await this.storageService.getCurrentWallet();

    if (!this.wallet) {
      this.alertServ.openSnackBar('No current wallet was found.', 'Ok');
      return;
    }  
    this.changeContractName('Lock FAB or EXG for SEED airdrop');
    for (let i = 0; i < this.wallet.mycoins.length; i++) {
      const coin = this.wallet.mycoins[i];
      if ((coin.name === 'FAB') && !coin.tokenType && !this.balance) {
        this.mycoin = coin;
        this.balance = await this.coinServ.getBalance(coin);
        console.log('this.balance=', this.balance);
        // break;
      } else 
      if (coin.name === 'ETH') {
        this.ethCoin = coin;
        try {
          this.ethBalance = await this.coinServ.getBalance(coin);  
        } catch(e) {

        }
              
      }
      if(coin.name === 'EXG' && coin.tokenType == 'FAB') {
        this.exgCoin = coin;
      }
    }  
    

    if (!this.mycoin) {
      this.alertServ.openSnackBar('no fab coin found for this wallet.', 'Ok');
      return;
    }  
    
    const fabAddress = this.mycoin.receiveAdds[0].address;

    this.apiServ.getEXGLockerDetail(fabAddress).subscribe(
      (ret:any) => {
        if(ret.success) {
          if(ret.data && (ret.data.length > 0)) {
            console.log('ret.data==', ret.data);
            this.lockerHashes = ret.data;
            console.log('this.lockerHashes==', this.lockerHashes);
            console.log(this.lockerHashes.length);
          }
          
        }
      }
    );
    
  }

  getMethodDefinition = (json, method) => {
  
    return json.find(({ type, name }) => (
      name === method && type === 'function'
    ));
  }

  changeMethod(val: string) {
    this.abiName = val;
    this.renderMethod(val);
  }

  renderAbi(def: any) {
    const inputs = def.inputs;
    if(inputs && inputs.length > 0) {
      for(let i=0;i<inputs.length;i++) {
        const input = inputs[i];
        if(input.name === '_account' && input.type==='address' && this.smartContractAddress === environment.addresses.smartContract.EXG.FAB) {
          input.val = this.exgCoin.receiveAdds[0].address;
          if(!input.val.startsWith('0x')) {
            input.val = this.utilServ.fabToExgAddress(input.val);
          }
          console.log('input.val===', input.val);
        }      
      }
    }
    this.method = def;
    console.log('this.method===', this.method);
  }

  inputCustomAbi(event) {
    this.customAbi = this.customAbi.replace(/'/g, '"');
    const def = JSON.parse(this.customAbi);
    console.log('def=====', def);
    this.formTypes(def);
    this.renderAbi(def);
  }
  
  renderMethod(method: string) {

    const def = this.getMethodDefinition(this.ABI, method);
    console.log('def===', def);
    if(!def) {
      return;
    }
    this.renderAbi(def);
  }

  callContract() {
    const address = this.utilServ.stripHexPrefix(this.smartContractAddress);
    const abiHex = this.utilServ.stripHexPrefix(this.formABI());


    const sender = this.mycoin.receiveAdds[0].address;

    if (!sender) {
      this.alertServ.openSnackBar('address was not found.', 'Ok');
      return;
    }


    this.apiServ.callFabSmartContract(address, abiHex, sender).subscribe((res: any) => {
      console.log('res=', res);
      this.payableValue = 0;
      this.result = res;
    });
  }
  async submit() {
    
    if (this.method.stateMutability === 'view') {
      this.callContract();
    } else {
      if (Number(this.payableValue) > this.balance.balance) {
        this.alertServ.openSnackBar('not enough amount.', 'Ok');
        return;
      }
      await this.pinModal.show(); 
    }
  }

  formABI() {
    const vals: any = [];
    for (let i = 0; i < this.method.inputs.length; i++) {
      const input = this.method.inputs[i];
      let val: any = input.val;
      if(!val) {
        val = '0x0000000000000000000000000000000000000000000000000000000000000000';
      }
      vals.push(val);
    }

    const abi = this.web3Serv.getGeneralFunctionABI(this.method, vals);
    return abi;
  }

  async deployEthDo(seed) {

    const keyPair = this.coinServ.getKeyPairs(this.ethCoin, seed, 0, 0);
    const nonce = await this.apiServ.getEthNonce(this.ethCoin.receiveAdds[0].address);

    this.ethData = this.formCreateEthSmartContractABI();
    const txParams = {
        nonce: nonce,
        gasPrice: 100000000000,
        gasLimit: 8000000,
        value: 0,
        data: this.ethData          
    };

    // console.log('txParams=', txParams);
    const txHex = await this.web3Serv.signTxWithPrivateKey(txParams, keyPair);


    const retEth = await this.apiServ.postEthTx(txHex);   

    console.log('retEth===', retEth);
    if(retEth && retEth.txHash) {
      this.alertServ.openSnackBarSuccess('Smart contract was deploy successfully.', 'Ok');
    }

  }

  async deployFabDo(seed) {
    this.smartContractAddress = '0x0';
    await this.callFabSmartContract(seed);
  }

  async deployKanbanDo(seed) {
    const keyPairsKanban = this.coinServ.getKeyPairs(this.exgCoin, seed, 0, 0);
    // const nonce = await this.apiServ.getEthNonce(this.ethCoin.receiveAdds[0].address);
    let gasPrice = environment.chains.KANBAN.gasPrice;
    let gasLimit = 8000000;
    const nonce = await this.kanbanServ.getTransactionCount(keyPairsKanban.address);

    //let kanbanTo = '0x0000000000000000000000000000000000000000';

    let kanbanValue = 0;

    const kanbanData = this.formCreateKanbanSmartContractABI();
    const txObject = {
        nonce: nonce,
        gasPrice: gasPrice,
        gasLimit: gasLimit,
        //to: kanbanTo,
        value: kanbanValue,
        data: '0x' + this.utilServ.stripHexPrefix(kanbanData)          
    };

    let privKey: any = keyPairsKanban.privateKeyBuffer;

    if(!Buffer.isBuffer(privKey)) {
      privKey = privKey.privateKey;
    }
    
    let txhex = '';


    const customCommon = Common.forCustomChain(
      environment.chains.ETH.chain,
      {
        name: environment.chains.KANBAN.chain.name,
        networkId: environment.chains.KANBAN.chain.networkId,
        chainId: environment.chains.KANBAN.chain.chainId
      },
      environment.chains.ETH.hardfork,
    );
    let tx = new Eth.Transaction(txObject, { common: customCommon });


    tx.sign(privKey);
    const serializedTx = tx.serialize();
    txhex = '0x' + serializedTx.toString('hex');

    this.kanbanServ.sendRawSignedTransaction(txhex).subscribe(
      (resp: any) => {
        console.log('resp for deploy kanban==', resp);
      if (resp && resp.transactionHash) {
        this.result = 'txid:' + resp.transactionHash;
        this.alertServ.openSnackBarSuccess('Smart contract was created successfully.', 'Ok');

        var that = this;
        var myInterval = setInterval(function(){ 
          that.kanbanServ.getTransactionReceipt(resp.transactionHash).subscribe(
            (receipt: any) => {
              if(receipt && receipt.transactionReceipt) {
                clearInterval(myInterval);
                if(receipt.transactionReceipt.contractAddress) {
                  that.newSmartContractAddress = receipt.transactionReceipt.contractAddress;
                }
              }
            }
          );
        }, 1000);
      } else {
        this.alertServ.openSnackBar('Failed to create smart contract.', 'Ok');
      }
    },
    error => {
      this.alertServ.openSnackBar(error.error, 'Ok');
    }
    );
    /*
    const keyPair = this.coinServ.getKeyPairs(this.ethCoin, seed, 0, 0);
    const nonce = await this.apiServ.getEthNonce(this.ethCoin.receiveAdds[0].address);
    console.log('this.ethData = ', this.ethData);

    this.ethData = this.formCreateEthSmartContractABI();
    const txParams = {
        nonce: nonce,
        gasPrice: 100000000000,
        gasLimit: 8000000,
        value: 0,
        data: this.ethData          
    };

    // console.log('txParams=', txParams);
    const txHex = await this.web3Serv.signTxWithPrivateKey(txParams, keyPair);


    const retEth = await this.apiServ.postEthTx(txHex);   

    console.log('retEth===', retEth);
    if(retEth && retEth.txHash) {
      this.alertServ.openSnackBarSuccess('Smart contract was deploy successfully.', 'Ok');
    }
    */
  }

  async callKanbanDo(seed) {
    this.formAbiHex();
    
    const keyPairsKanban = this.coinServ.getKeyPairs(this.exgCoin, seed, 0, 0);
    let gasPrice = environment.chains.KANBAN.gasPrice;
    let gasLimit = environment.chains.KANBAN.gasLimit;
    const nonce = await this.kanbanServ.getTransactionCount(keyPairsKanban.address);
    
    let kanbanTo: any = null;
    let kanbanValue = 0;
    if(this.kanbanTo) {
      kanbanTo = this.kanbanTo;
    }
    
    const txObject = {
        nonce: nonce,
        gasPrice: gasPrice,
        gasLimit: gasLimit,
        to: kanbanTo,
        value: '0x' + kanbanValue.toString(16),
        data: '0x' + this.utilServ.stripHexPrefix(this.kanbanData)          
    };

    const privKey = Buffer.from(keyPairsKanban.privateKeyHex, 'hex');

    let txhex = '';


    const customCommon = Common.forCustomChain(
      environment.chains.ETH.chain,
      {
        name: environment.chains.KANBAN.chain.name,
        networkId: environment.chains.KANBAN.chain.networkId,
        chainId: environment.chains.KANBAN.chain.chainId
      },
      environment.chains.ETH.hardfork,
    );
    const tx = new Eth.Transaction(txObject, { common: customCommon });

    tx.sign(privKey);
    const serializedTx = tx.serialize();
    txhex = '0x' + serializedTx.toString('hex');

    this.kanbanServ.sendRawSignedTransaction(txhex).subscribe(
      (resp: any) => {
      if (resp && resp.transactionHash) {
        this.txid = resp.transactionHash;
        this.alertServ.openSnackBarSuccess('Smart contract was called successfully.', 'Ok');
      } else {
        this.alertServ.openSnackBar('Failed to call smart contract.', 'Ok');
      }
    },
    error => {
      this.alertServ.openSnackBar(error.error, 'Ok');
    }
    );

  }

  getReceiptLink(txid) {
    return '/explorer/tx-detail/' + txid;
    //return environment.endpoints.kanban + 'kanban/getTransactionReceipt/' + txid;
  }

  formCreateSmartContractABI() {
    let abi = JSON.parse(this.fabABI);

    let args: any = [];
    let argsParsed;
    try {
      argsParsed = JSON.parse(this.fabArguments);
    } catch(e) {}
    if(!Array.isArray(argsParsed)) {
      console.log('11111');
      args = this.fabArguments.split(',').map(item => {return item.trim()});
      console.log('final args=', args);
    } else {
      args = argsParsed;
    }

    return this.web3Serv.formCreateSmartContractABI(abi, this.fabBytecode.trim(), args);
 
  }

  formCreateEthSmartContractABI() {
    const abi = JSON.parse(this.ethABI);
    let args: any = [];
    if(this.ethArguments) {
      args = this.ethArguments.split(',').map(item => {return item.trim()});
    }
    return this.web3Serv.formCreateSmartContractABI(abi, this.ethBytecode.trim(), args);
 
  }

  getReceipt(txid: string) {
    return 'https://fab' + (environment.production ? 'prod' : 'test') + '.fabcoinapi.com/gettransactionreceipt/' + txid;
  }

  formCreateKanbanSmartContractABI() {
    const abi = JSON.parse(this.kanbanABI);
    const args = JSON.parse(this.kanbanArguments);
    /*
    [];
    if(this.kanbanArguments) {
      args = this.kanbanArguments.split(',').map(item => {return item.trim()});
    }
    */
    return this.web3Serv.formCreateSmartContractABI(abi, this.kanbanBytecode.trim(), args);
 
  }

  async callFabSmartContract(seed) {
    let abiHex = '';
    let gasLimit = this.gasLimit;
    //gasLimit = 8000000;
    const gasPrice = this.gasPrice;    
    let smartContractAddress = this.smartContractAddress;
    if(smartContractAddress == '0x0') {
      gasLimit = 8000000;
      abiHex = this.formCreateSmartContractABI();
      console.log('abiHex for smart contract:', abiHex);
      //smartContractAddress = null;
    } else {
      abiHex = this.formABI();
    }
    

    let value = 0;
    if (this.method && this.method.stateMutability === 'payable') {
      value = Number(this.payableValue);
    }
    console.log('value=', value);
    const totalAmount = gasLimit * gasPrice / 1e8;
    // let cFee = 3000 / 1e8 // fee for the transaction

    let totalFee = totalAmount;

    //console.log('number==', (smartContractAddress == '0x0') ? 193 : 194);

    console.log('gasLimit=', gasLimit);
    let contract = Btc.script.compile([
      84,
      this.utilServ.number2Buffer(gasLimit),
      this.utilServ.number2Buffer(gasPrice),
      this.utilServ.hex2Buffer(this.utilServ.stripHexPrefix(abiHex)),
      this.utilServ.hex2Buffer(this.utilServ.stripHexPrefix(smartContractAddress)),
      194
    ]);    
    if(smartContractAddress == '0x0') {
      
      contract = Btc.script.compile([
        84,
        this.utilServ.number2Buffer(gasLimit),
        this.utilServ.number2Buffer(gasPrice),
        this.utilServ.hex2Buffer(this.utilServ.stripHexPrefix(abiHex)),
        193
      ]); 
    }

  
    console.log('smartContractAddress123==', smartContractAddress);
    const contractSize = contract.toJSON.toString().length;
    totalFee += this.utilServ.convertLiuToFabcoin(contractSize * 10);

    console.log('this.mycoin==', this.mycoin);
    this.mycoin.tokenType = 'FAB';
    const res = await this.coinServ.getFabTransactionHex(seed, this.mycoin, contract, value, 
      totalFee, environment.chains.FAB.satoshisPerBytes, environment.chains.FAB.bytesPerInput, false);
    
    const txHex = res.txHex;
    let errMsg = res.errMsg;
    let txHash = '';
    if (!errMsg) {
        const res2 = await this.apiServ.postFabTx(txHex);
        txHash = res2.txHash;
        console.log('txHashtxHash=', txHash);
        errMsg = res2.errMsg;
        if (txHash) {
          this.result = txHash;
        } else 
        if (errMsg) {
          this.error = errMsg;
          this.txHex = txHex;
        }
    } else {
      console.log('error msg=', errMsg);
      this.error = errMsg;
      this.txHex = txHex;
    } 
  }

  deployKanban() {
    this.action = 'deployKanban';
    this.pinModal.show(); 
  }

  async onConfirmedPin(pin: string) {

    
    const seed = this.utilServ.aesDecryptSeed(this.wallet?.encryptedSeed, pin);
    if (!seed) {
      this.alertServ.openSnackBar('Your password is wrong.', 'Ok');
    }

    if(!this.action || (this.action == '')) {
      await this.callFabSmartContract(seed);
    } else 
    if(this.action == 'deployEth') {
      await this.deployEthDo(seed);
    } else
    if(this.action == 'deployFab') {
      await this.deployFabDo(seed);
    } else    
    if(this.action == 'callKanban') {
      await this.callKanbanDo(seed);
    } else
    if(this.action == 'deployKanban') {
      await this.deployKanbanDo(seed);
    }
  }

  deployEth() {
    this.action = 'deployEth';
    this.pinModal.show(); 
  }

  deployFab() {
    this.action = 'deployFab';
    this.pinModal.show();     
  }

  callKanban() {
    this.action = 'callKanban';
    this.pinModal.show(); 
  }

  async viewKanban() {
    const to = this.kanbanTo;
    this.formAbiHex();
    const data = '0x' + this.utilServ.stripHexPrefix(this.kanbanData);
    const res = await this.kanbanServ.kanbanCall(to, data);  
    console.log('res===', res); 
    this.result = JSON.stringify(res);
    
  }

  decodeABI() {
    if (this._kanbanCallABI) {
      this._kanbanCallArgs = [];
      try {
        const doubleQuoteABI = this._kanbanCallABI.replace(/'/g, '"');
        const abi = JSON.parse(doubleQuoteABI);
        for (let j = 0; j < abi.inputs.length; j ++) {
          const input = abi.inputs[j];
          const type = input.type;
          const name = input.name;
          this._kanbanCallArgs.push(
            {
              name: name,
              type: type,
              value: '' // Set 0 as initial value to replace with input value after
            }
          );
        }
      } catch(e) {
        console.log('error when decoding ABI', e);
      }
    }
  }
}
