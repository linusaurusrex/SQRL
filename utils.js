"use strict";
const base56chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

function memzero(e)
{
	if (!(e instanceof Uint8Array))
		throw new Error("Only Uint8Array instances can be wiped");
	for (let t=0,r=e.length;t<r;t++)
		e[t]=0
}
function str2ab(str) //string to arraybuffer (Uint8Array)
{
	let ute = new TextEncoder("utf-8");
	return ute.encode(str);
}
function ab2int(ab) //arraybuffer (Uint8Array) to int. Only works up to Number.MAX_SAFE_INTEGER or ab.length == 6
{
	if (!(ab instanceof Uint8Array))
		throw new Error("First argument \"ab\" should be a  Uint8Array");
	if (ab.length > 6)
		throw new Error("Max length of Uint8Array is 6");
	let result = 0;
	let fact = 1;
	for (let i of ab)
	{
		result += fact * i;
		fact *= 256;
	}
	fact = 0; //cleanup
	return result;
}
function ab2hex(ab) //arraybuffer (Uint8Array) to hex
{
	let result = [];
	for (let i of ab)
	{
		result.push(('00'+i.toString(16)).slice(-2));
	}
	return result.join('');
}
function ar2hex(ar) //array of integers to hex
{
	return ar.map(i => ('00'+i.toString(16)).slice(-2)).join('');
}
function ui8aXOR(a, b) //beware: result is written back into a
{
	for (let i = 0; i < a.length; i++)
	{
		a[i] =  a[i] ^ b[i];
	}
}
//uses https://github.com/tonyg/js-scrypt/raw/master/browser/scrypt.js
function enscrypt(scrypt, pwd, salt, iterations)
{
	let result = scrypt(pwd, salt, 512, 256, 1, 32);
	let xorresult = new Uint8Array(result);
	for (let i = 1; i < iterations; i++)
	{
		result = scrypt(pwd, result, 512, 256, 1, 32);
		ui8aXOR(xorresult, result);//result of XOR is written back into xorresult
	}
	memzero(result);
	return xorresult;
}
function aesGcmDecrypt(data, keyStr, iv)
{
	if (typeof keyStr == "string" && keyStr.length > 0)
	{
		if (iv.constructor === Uint8Array && iv.length === 16)
		{
			if (data.constructor === Uint8Array && data.length > 0)
			{
				return importKey(keyStr, "decrypt").then(key => {
					return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data).then(decrypted => {
						let decoder = new TextDecoder("utf-8");
						return decoder.decode(new Uint8Array(decrypted));
					});
				});
			}
			else
				throw new Error('Argument 1 "data" should be a non-empty Uint8Array');
		}
		else
			throw new Error('Argument 3 "iv" should be a Uint8Array of length 16');
	}
	else
		throw new Error('Argument 2 "key" should be a non-empty String');
}



//uses BigNum, https://github.com/indutny/bn.js/
function base56encode(i)
{
	let bi;
	if (i instanceof BN)
		bi = i;
	else if (typeof i == "string")
		bi = new BN(i);
	else if (typeof i == "number")
	{
		if (i > Number.MAX_SAFE_INTEGER)
			throw new Error('base56encode: ERROR. Argument 1 "i" larger than ' + Number.MAX_SAFE_INTEGER + ' should be represented as String or BigInt');
		bi = new BN(i);
	}
	else
		throw new Error('base56encode: ERROR. Argument 1 "i" should be an integer represented as String, BigInt or Number');
	if (bi.isNeg())
		throw new Error('base56encode: ERROR. Argument 1 "i" should be positive');
	let result = [];
	do
	{
		let r = bi.modn(56);
		let q = bi.divn(56);
		result.push(base56chars[r]);
		bi = q;
	}
	while (bi.gtn(0));
	return result.join('');
}
function base56decode(s)
{
	if (typeof s != "string")
		throw new Error('base56decode: ERROR. Argument 1 "s" should be a String');
	if (/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]/.test(s))
		throw new Error('base56decode: ERROR. Argument 1 "s" can only contain valid base56 characters [23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]');
	if (s == null || s == "")
		return 0;
	let result = new BN(0);
	let factor = new BN(1);
	for (let c of s.split(''))
	{
		result.iadd(factor.muln(base56chars.indexOf(c)));
		factor.imuln(56);
	}
	return result;
}
function isValidHostname(hn)
{
	//FIXME: it is assumed that the hostname is punycode encoded - test and/or fix this
	/*
	Hostnames are composed of series of labels concatenated with dots, as are all domain names.
	For example, "en.wikipedia.org" is a hostname. Each label must be between 1 and 63 characters long, and the entire hostname has a maximum of 255 characters.
	RFCs mandate that a hostname's labels may contain only the ASCII letters 'a' through 'z' (case-insensitive), the digits '0' through '9', and the hyphen. Hostname labels cannot begin or end with a hyphen. No other symbols, punctuation characters, or blank spaces are permitted.
	*/
	if (hn == null || typeof hn != "string" || hn.length == 0 || hn.length  > 255 || !/^[a-zA-Z0-9\.\-]+$/.test(hn))
		return false;
	let splt = hn.split(".");
	for (let lbl of splt)
		if (lbl.length < 1 || lbl.length > 63 || lbl.startsWith('-') || lbl.endsWith('-'))
			return false;
	return true;
}
