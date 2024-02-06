# 1024-bit Implementation

This is a realistic implementation that uses a 1024-bit integer for $(N)$ to assess the protocol’s performance and feasibility.

## Getting Started

- Change the directory to one of the `SemiPublicHash-No`, `SemiPublicHash-Posiedon`, or `SemiPublicHash-sha256` folders.
- Run `npm i` to install dependencies.
- Change the directory to the `build` folder (`cd build`).
- Install [`rapidsnark`](https://github.com/iden3/rapidsnark) inside the `build` folder (you may need `sudo` privilege). Ensure that `./rapidsnark/build/prover` exists.
- Obtain `powersOfTau_25_final.ptau` by downloading it from the [link](https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_25.ptau) or build it using `./poweroftau_gen.sh`.
- Run `./build.sh -d [TREE_DEPTH]` to build the zkSNARK artifacts, where `TREE_DEPTH` is the Merkle tree depth. For example, run `./build.sh -d 4` for a maximum number of voters of $(2^4)$.
- Run `npm run test` to test a full scenario for 5 voters and get the gas cost of each transaction. 

  You can specify the number of voters by setting the variable `nVoters=[NUMBER_of_VOTERS]` as follows:
  ```shell
  nVoters=5 npm run test
  ```
## Best Practices:

The size of the zk-SNARK circuit $(C_V)$ is approximately 20M constraints. Therefore, you may need a large hard drive with swap enabled. In our experiments, we use a 1T hard drive and 200G swap. Also, you may need to adjust the system memory limit and create the swap as follows:

### Remove system memory limit
```shell
sudo sysctl -w vm.max_map_count=10000000
```
### Set up swap memory

```shell
sudo fallocate -l 200G swapfile
sudo chmod 600 swapfile
sudo mkswap swapfile
sudo swapon swapfile
```

For more details, check [Best Practices](https://hackmd.io/V-7Aal05Tiy-ozmzTGBYPA?view).

## Acknowledgments

We use a circom bigint library from [circom-ecdsa](https://github.com/0xPARC/circom-ecdsa/blob/master/circuits/bigint.circom). This library employs an optimization for big integer multiplication from [xJsnark](https://github.com/akosba/xjsnark).

We use a Solidity BigNumber library from [solidity-BigNumber](https://github.com/firoorg/solidity-BigNumber/blob/master/src/BigNumbers.sol).
