const express = require('express');
const router = express.Router();
const mysql = require('mysql')
const config = require('../configs/connection');
const SECRET_KEY = require('../configs/keys')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const { response_payload, data_encrypt, data_decrypt } = require('../methods/global')
const { authenticateToken } = require('../middlewares/token')

router.post('/login', async (req, res) => {
    try {
        const connection = await mysql.createConnection(config);
        const sql = 'SELECT * FROM student WHERE student_number=? LIMIT 1';

        //Very important to decrypt data first
        let { student_number, student_password } = data_decrypt(req.body.m)

        //Check if student Exist
        connection.query({
            sql: sql,
            timeout: 5000,
            values: [student_number]
        }, async (error, results) => {
            if (error) {
                res.status(400).send(data_encrypt(response_payload(null, "Error", "Failed Query")))
                throw error;
            } else {
                if (results.length != 0) {
                    let name = results[0].student_fname + ' ' + results[0].student_lname
                    let number = results[0].student_number

                    // Compare tokens
                    if (await bcrypt.compare(student_password, results[0].student_password)) {
                        const checkIfTokenExist = 'SELECT * FROM token WHERE student_number=? LIMIT 1';

                        connection.query({
                            sql: checkIfTokenExist,
                            timeout: 5000,
                            values: [student_number]
                        }, (error, results) => {
                            if (results.length != 0) {
                                res.status(200).send(data_encrypt(response_payload({ token: results[0].token_value }, "Welcome", "Successfully Logged in!")))
                            } else {
                                const createAccessTokenSQL = 'INSERT INTO token(`student_number`,`token_value`) VALUES(?,?)';
                                const accessToken = jwt.sign({ student_number: req.body.student_number, student_password: req.body.student_password }, SECRET_KEY)

                                connection.query({
                                    sql: createAccessTokenSQL,
                                    timeout: 5000,
                                    values: [student_number, accessToken]
                                }, (error, results) => {
                                    if (error) {
                                        res.status(400).send(data_encrypt(response_payload(null, "Error", "Failed to Log In")))
                                        throw error;
                                    } else {
                                        res.status(200).send(data_encrypt(response_payload({ token: accessToken, student_name: name, student_number: number }, "Welcome", "Successfully Logged in!")))
                                    }
                                })
                            }
                        })
                        //Create Token


                    } else {
                        res.status(403).send(data_encrypt(response_payload(null, "Error", "Student number or Password is incorrect")))
                    }
                } else {
                    res.status(404).send(data_encrypt(response_payload(null, "Error", "No Account")))
                }

            }

        })


    } catch {
        res.status(500).send(response_payload(null, "Error", "Server Crashed"))
    }

})

router.delete('/logout', authenticateToken, async (req, res) => {
    //Simply delete token
    try {
        const connection = await mysql.createConnection(config);
        const sql = 'DELETE FROM token WHERE token_value=?';
        const header = req.headers.authorization
        const [_, token] = header.split(' ')

        connection.query({
            sql: sql,
            timeout: 5000,
            values: [token]
        }, (error, results) => {
            if (results.length != 0) {
                if (error) {
                    res.status(400).send(data_encrypt(response_payload(null, "Error", "Failed to Delete Token")))
                    throw error;
                } else {
                    res.status(200).send(data_encrypt(response_payload(null, "Success", "Token Deleted")))
                }
            } else {
                res.status(404).send(data_encrypt(response_payload(null, "Error", "No Account")))
            }

        })
    } catch {
        res.status(500).send(data_encrypt(response_payload(null, "Error", "Server Crashed")))
    }

})

module.exports = router;
