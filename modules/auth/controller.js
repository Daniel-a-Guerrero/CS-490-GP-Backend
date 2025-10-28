const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const {firebaseSignIn, firebaseSignUp} = require('./service')

exports.login=async (req,res)=>{
    try{
    const {userEmail, passWord}=req.body
    if(!(userEmail&&passWord)){
        return res.status(400).json({ error: 'Must enter Username and password' });
    }
    const result=await firebaseSignIn(userEmail,passWord)
    res.status(200).json({token: result.idToken, user:result.user})
    }catch(error){
        console.error("Login error ",error)
        if(error.message==="INVALID_PASSWORD"||error.message==="EMAIL_NOT_FOUND"){
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        return res.status(500).json({error:"login failed"})
    }
}
exports.signup=async(req,res)=>{
    try{
        const {full_name, phone, userEmail, passWord, role }=req.body
        console.log(req.body)
        if(!(full_name&& phone&& userEmail&& passWord&& role)){
            return res.status(400).json({ error: 'Must enter all proper information' });
        }

        const result=await firebaseSignUp(full_name, phone, userEmail, passWord, role);
        res.status(201).json({result})
    }catch(error){
        console.error("Signin error ",error)
        return res.status(500).json({error:error.message})
    }
}
exports.logout=async(req,res)=>{
    try{
        return res.status(200).json({message: 'Logged out successfully' });
    }
    catch(error){
        console.error("Sign out error ",error)
        return res.status(500).json({error:error.message})
    }
}

exports.miscel = async(req,res)=>{
    res.send('Hello world')
}
