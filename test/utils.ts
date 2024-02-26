import {ethers} from "hardhat";
import BigNumber from "bignumber.js";

export interface EIP712Domain {
    name:string
    version: string
    chainId: number
    verifyingContract: string
}

export interface ForwardRequest {
    from: string
    to: string
    value: number
    gas: number
    nonce: number
    data: string
}

export async function singMetatx(
    fromAddress: string,
    domain: EIP712Domain,
    message: ForwardRequest,
){
    const compose = {
        types: {
            EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
            ],
            ForwardRequest: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'gas', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'data', type: 'bytes' },
            ]
        },
        domain,
        primaryType: "ForwardRequest",
        message
    }
    return ethers.provider.send('eth_signTypedData_v4',[fromAddress, compose])
}

export function parseUnits(value: number, decimals: number) {
  const bn = new BigNumber(value)
    const ten = new BigNumber(10)
    return bn.times(ten.pow(decimals)).toFixed(0)
}