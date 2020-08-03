'use strict';

// モジュール
const express = require( 'express' );
const http = require( 'http' );
const socketIO = require( 'socket.io' );
const fs = require('fs');
const readline = require('readline');

// オブジェクト
const app = express();
const server = http.Server( app );
const io = socketIO( server );

// 定数
const PORT = process.env.PORT || 3000;
const SYSTEMNICKNAME = '管理人';

// 関数
// 数字を２桁の文字列に変換
const toDoubleDigitString = (num) => {
    return ( "0" + num ).slice( -2 );   // slice( -2 )で後ろから２文字取り出す。
};

// 時刻文字列の作成（書式は「YY/DD/MM hh:mm ss」）
const makeTimeString = (time) => {
    return toDoubleDigitString(time.getFullYear()) + '/' + toDoubleDigitString(time.getMonth() + 1) + '/' + toDoubleDigitString(time.getDate())
    + ' ' + toDoubleDigitString( time.getHours() ) + ':' + toDoubleDigitString( time.getMinutes());
}

const filtering = (word) => {
    fs.readFile('./NG_word.txt', 'utf-8', (err,data) => {
        if(err) {
            throw err;
        }
        console.log(data);
    });
    return true;
}

// グローバル変数
let iCountUser = 0; // ユーザー数
let typing = false; //入力中かどうか
let socketTmp;

// 接続時の処理
// ・サーバーとクライアントの接続が確立すると、
// 　サーバー側で、'connection'イベント
// 　クライアント側で、'connect'イベントが発生する
io.on('connection', (socket) => {
    console.log('connection');

    let strNickname = '';	// コネクションごとで固有のニックネーム。イベントをまたいで使用される。
    let room = '';

        // 切断時の処理
        // ・クライアントが切断したら、サーバー側では'disconnect'イベントが発生する
        socket.on('disconnect', () => {
            console.log( 'disconnect' );

            if(strNickname) {
                    // ユーザー数の更新
                    iCountUser--;

                    // メッセージオブジェクトに現在時刻を追加
                    const strNow = makeTimeString( new Date() );

                    // システムメッセージの作成
                    const objMessage = {
                        strNickname: SYSTEMNICKNAME,
                        strMessage: strNickname + 'さんが退室しました。' + "現在のユーザー数は" + iCountUser + "人です。",
                        strDate: strNow,
                        type: 'system'
                    };
                

                    // 送信元含む全員に送信
                    socket.broadcast.emit( 'spread message', objMessage );
            }
        });

        // 入室時の処理
        // ・クライアント側のメッセージ送信時の「socket.emit( 'join', strNickname );」に対する処理【12】
        socket.on('join', ( strNickname_ , joinRoom_) => {
                room = joinRoom_;
                socket.join(room);

                //現在のsocketIDを格納
                socketTmp = socket.id;

                console.log( 'joined :', strNickname_);
                console.log(room);

                // コネクションごとで固有のニックネームに設定
                strNickname = strNickname_;

                // ユーザー数の更新
                iCountUser++;

                // メッセージオブジェクトに現在時刻を追加
                const strNow = makeTimeString( new Date() );

                
                // システムメッセージの作成
                const objMessage = {
                    strNickname: SYSTEMNICKNAME,
                    strMessage: strNickname + 'さんが入室しました。' + "現在のユーザー数は" + iCountUser + "人です。",
                    strDate: strNow,
                    type: 'system'
                };

                // 送信元含む全員に送信
                io.to(room).emit( 'spread message', objMessage );
        });

        // 新しいメッセージ受信時の処理
        // ・クライアント側のメッセージ送信時の「socket.emit( 'new message', $( '#input_message' ).val() );」に対する処理
        socket.on('new message', (strMessage) => {
                typing = false;
                console.log( 'new message', strMessage );

                // 現在時刻の文字列の作成
                const strNow = makeTimeString( new Date() );

                //送信側か受信側かを分ける
                let messageType;

                if(socketTmp === socket.id) {
                    messageType = 'send';
                }
                else {
                    messageType = 'receive';
                }

                //console.log('socket id:', socket.id);
                // 送信元含む全員に送信
                //io.emit( 'spread message', strMessage );
                if(filtering(strMessage) === true) {

                    // メッセージオブジェクトの作成
                    const objMessage = {
                        strNickname: strNickname,
                        strMessage: strMessage,
                        strDate: strNow,
                        type: messageType
                    };
                    io.to(room).emit( 'spread message', objMessage );
                }
                else {
                    alert('特定の単語が含まれているため、その内容のメッセージは送信出来ません');
                }
                
        });

        //メッセージ入力中の処理
        socket.on('typing', () => {

            if(typing === false) {
                typing = true;
                console.log('now typing');
                const strNow = makeTimeString( new Date() );
                const statusMessage = '入力中です';

                const objMessage = {
                    strNickname: strNickname,
                    strMessage: statusMessage,
                    strDate: strNow,
                    type: 'system'
                };

                socket.broadcast.emit('spread message', objMessage);
            }
        });

        socket.on('stop typing', () => {

        });

        //NGワード登録時の処理
        socket.on('word regist', (word) => {
            fs.appendFile('./NG_word.txt', word, (error, data) => {
                console.log(word);
                if(error) {
                    console.log(error);
                    
                }
                else {
                    console.log('write end');
                }
            });
        });
});

// 公開フォルダの指定
app.use( express.static( __dirname + '/public' ) );

// サーバーの起動
server.listen(PORT,() => {
    console.log( 'Server on port %d', PORT );
});