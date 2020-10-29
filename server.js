'use strict';

//基本モジュール
const express = require( 'express' );
const http = require( 'http' );
const socketIO = require( 'socket.io' );
const fs = require('fs');
const jsonfile = require('jsonfile');

//形態素解析用のモジュール
const kuromoji = require('kuromoji');

//スクレイピング用のモジュール
const cheerio = require('cheerio-httpcli');

//スクレイピングする検索エンジンのURL(Google)
const searchEngineURL = 'https://www.google.co.jp/search';

// オブジェクト
const app = express();
const server = http.Server( app );
const io = socketIO( server );

// 定数
const PORT = process.env.PORT || 3000;
const SYSTEMNICKNAME = '管理人';
const WARNING = '特定の単語が含まれているため、その内容のメッセージは送信出来ません';
const wp = '振替';  //非悪口極性の単語
const wn = '消えろ'; //悪口極性の単語
const a = 0.9;  //重み定数

// 関数
// 数字を２桁の文字列に変換
const toDoubleDigitString = (num) => {
    return ( "0" + num ).slice( -2 );   // slice( -2 )で後ろから２文字取り出す。
};

// 時刻文字列の作成（書式は「YY/DD/MM hh:mm ss」）
const makeTimeString = (time) => {
    return toDoubleDigitString(time.getFullYear()) + '/' + toDoubleDigitString(time.getMonth() + 1) + '/' + toDoubleDigitString(time.getDate())
    + ' ' + toDoubleDigitString( time.getHours() ) + ':' + toDoubleDigitString( time.getMinutes());
};

//NGワードとの文字列比較を行う
const filtering = async (word, roomNum) => {

    //NGワードを格納する配列
    let wordArray = Array();

    //文字列比較用
    let str = '';

    //NGワードファイルを格納する一時変数
    let data;

    //判定結果   true: 送信可能なメッセージ,  false: 送信出来ないメッセージ
    let result = true;

    //NGワードファイルを読み込む
    try {
        console.log(roomNum);
        data = fs.readFileSync('./NG_word' + roomNum + '.txt', 'utf-8');

        //カンマで分割して配列に格納
        wordArray = data.split(',');
    }
    catch(e) {
        console.log(e);
    }

    //完全一致するかどうか
    for(let i=0; i<wordArray.length-1; i++) {

        //一致したらfalseにしてループを抜ける
        if(wordArray[i] === word) {
            console.log('bad-word');
            result = false;
            break;
        }
    }

    //部分一致するかどうか
    for(let i=0; i<wordArray.length-1; i++) {

        //NGワードの配列の要素をstrに代入
        str = wordArray[i];
        
        //strと入力されたメッセージを比較
        if(word.indexOf(str) !== -1) {
            console.log('matched: ', str);
            result = false;
            break;
        }
    }

    /*
    例:  str : '消えろ',  word : 'お前は消えろ'    --->   部分一致している
         str : '消えろ',  word : 'こんにちは'      --->   部分一致していない
    */


    var builder = kuromoji.builder({
        //辞書があるディレクトリを指定
        dicPath: 'node_modules/kuromoji/dict'
    });
  
    // 形態素解析機を作るメソッド
    
    /*
    builder.build((err, tokenizer) => {
        // 辞書がなかった際のエラー表示
        if(err) { 
            throw err; 
        }
    
        // tokenizer.tokenize に文字列を渡して形態素解析する
        let tokens = tokenizer.tokenize(word);
        console.log(tokens);

        
    });
    */

    //算出した悪口度が0以下であれば悪口単語ではない
    if(await calc_abusiveness(word) <= 0) {
        result = false;
    }

    return result;
};

//web上での検索件数を基に悪口度を算出する関数
const calc_abusiveness = async (word) => {

    let c = 0;
    
    //c = Math.log((48800000 * 2620000) / (2970000 * 2970000));
    //c = Math.log(ansArray[0] * ansArray[1] / ansArray[2] * ansArray[3]);
    c = Math.log(await hit(word, wp) * await hit(wp) / await hit(word, wn) * await hit(wn));
    
    let f = 0;

    //f = a * Math.log(45400000 / 45400000);
    f = a * Math.log(await hit(wp) / await hit(wn));
    //f = a * Math.log(ansArray[4] / ansArray[5]);

    //悪口度
    let SO_PMI = 0;

    SO_PMI = c + f;

    console.log(c);
    console.log(f);
    console.log(SO_PMI);

    return SO_PMI;
};

//web検索結果の件数を検索エンジンのページからスクレイピングする関数
const hit = async (w1, w2) => {

    let i=0;

    //検索結果の件数を格納する変数
    var hit_count;

    //検索する文字列を格納する変数
    let query;

    //パラメータの数によってqueryの中身を変える
    if(!w1) {
        query = w2;
    }
    else if(!w2) {
        query = w1;
    }
    else {
        query = w1 + ' ' + w2;
    }

    console.log(query);
    
    //検索を行う

    /*
    let result = cheerio.fetchSync(searchEngineURL, {q: query});

    hit_count = result.$('#result-stats').text().replace(/約\s(.+)\s件.+/,"$1");

    console.log(hit_count);

    return hit_count;
    */
    
    cheerio.fetch(searchEngineURL, {q: query})
    .then((result) => {
        //スクレイピングした検索件数を数値のみの形式に置き換えて格納
        hit_count = result.$('#result-stats').text().replace(/約\s(.+)\s件.+/,"$1");

        console.log(hit_count);
    })
    .catch((err) => {
        console.log(err);
    })
    .finally(() => {
        console.log('done');
        return hit_count;
    });

};

// グローバル変数
let iCountUser = 0; // ユーザー数
let messageCount = 0; //ユーザーが短時間に送信したメッセージをカウントする
let typing = false; //入力中かどうか
let socketTmp; //ソケットIDの一時変数
let socketArray = Array(); //ユーザのソケットIDを保持しておく配列

// 接続時の処理
// サーバーとクライアントの接続が確立すると
// サーバー側で、'connection'イベント
// クライアント側で、'connect'イベントが発生する

io.on('connection', (socket) => {
    console.log('connection');

    let strNickname = '';	// コネクションごとで固有のニックネーム, イベントをまたいで使用される
    let room = '';
    let roomNum;

        // 切断時の処理
        // ・クライアントが切断したら、サーバー側では'disconnect'イベントが発生
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
        // ・クライアント側のメッセージ送信時の「socket.emit( 'join', strNickname );」に対する処理
        socket.on('join', (strNickname_ , joinRoom_) => {
                room = joinRoom_;
                roomNum = joinRoom_;
                socket.join(room);

                //現在のsocketIDを格納
                socketTmp = socket.id;

                console.log( 'joined :', strNickname_);
                console.log(room);

                // コネクションごとで固有のニックネームに設定
                strNickname = strNickname_;


                socketArray[iCountUser] = socket.id;
                
                // ユーザー数の更新
                iCountUser++;

                // メッセージオブジェクトに現在時刻を追加
                const strNow = makeTimeString(new Date());

                
                // システムメッセージの作成
                const objMessage = {
                    strNickname: SYSTEMNICKNAME,
                    strMessage: strNickname + 'さんが入室しました。' + "現在のユーザー数は" + iCountUser + "人です。",
                    strDate: strNow,
                    type: 'system'
                };

                //jsonファイルを読み込む
                var messageList = Array();

                let dir = 'message_list' + roomNum + '.json';

                messageList = JSON.parse(fs.readFileSync(dir,'utf-8'));


                /*
                var messageList = jsonfile.readFileSync(('message_list' + listNum + '.json'), {
                    encoding: 'utf-8',
                    reviver: null,
                    throws: true
                });
                */

                //メッセージの件数分メッセージをクライアント側に表示させる
                for (let i = 0; i < messageList.length; i++) {
                    io.to(socketTmp).emit('spread message', messageList[i]);
                }

                // 送信元含む全員に送信
                io.to(room).emit( 'spread message', objMessage );
        });

        // 新しいメッセージ受信時の処理
        // ・クライアント側のメッセージ送信時の「socket.emit( 'new message', $( '#input_message' ).val() );」に対する処理
        socket.on('new message', (strMessage, emoji, roomNum) => {
                typing = false;
                console.log( 'new message', strMessage );
                console.log('emotion:', emoji);

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

                //judge : 戻り値の判定用の変数
                //true -> NGワードでない, false -> NGワード

                //修正箇所
                (async () => {
                    let judge = await filtering(strMessage, roomNum);

                    if(judge) {
                        //NGワードではない場合
                        
                        const objMessage = {
                            strNickname: strNickname,
                            strMessage: strMessage,
                            strDate: strNow,
                            type: messageType,
                            emotion: emoji
                        };
    
                        //ルーム全員に送信
                        io.to(room).emit('spread message', objMessage);
    
                        //メッセージをjsonファイルに追記する(修正中)
    
    
                    }
                    else {
                        //NGワードの場合
    
                        messageType = 'system';
                        
                        const sysMessage = {
                            strNickname: SYSTEMNICKNAME,
                            strMessage: WARNING, //警告メッセージの定数
                            strDate: strNow,
                            type: messageType
                        };
    
                        //警告メッセージを送信元に送信
                        io.to(socket.id).emit('spread message', sysMessage);   
                    }

                })();
        });

        //メッセージ入力中の処理
        socket.on('typing', (roomNum) => {

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

                io.to(roomNum).emit('spread message', objMessage);
            }
        });

        //NGワード登録時の処理
        socket.on('word regist', (word, roomNum) => {

            //ルーム番号によってファイル名を決定
            let dir = './NG_word' + roomNum + '.txt';

            try {
                //NGワードをファイルに追記
                fs.appendFileSync(dir, word);
            }
            catch(e) {
                console.log(e);
            }
        });

        //NGワード削除時の処理
        socket.on('word delete', (id, roomNum) => {
            let wordArray = Array();
            let data;

            //ルーム番号によってファイル名を指定
            let dir = './NG_word' + roomNum + '.txt';

            try {
                data = fs.readFileSync(dir, 'utf-8');
                //カンマで分割して配列に格納
                wordArray = data.split(',');

                wordArray.splice(id-1,1); //idで指定された要素を削除(配列の添え字を考慮する)

                fs.writeFileSync(dir, wordArray);
            }
            catch(e) {
                console.log(e);
            }
        });

        //現在のNGワードの参照
        socket.on('view word', (roomNum) => {
            let wordArray = Array();
            let data;

            //ルーム番号によってディレクトリを決定
            let dir = './NG_word' + roomNum + '.txt';
            
            try {
                data = fs.readFileSync(dir, 'utf-8');
                //カンマで分割して配列に格納
                wordArray = data.split(',');

                io.to(roomNum).emit('view NG_word', wordArray);
            }
            catch(e) {
                console.log(e);
            }
        });
});

// 公開フォルダの指定
app.use(express.static(__dirname + '/public'));

// サーバーの起動
server.listen(PORT, () => {
    console.log('Server on port %d', PORT);
});