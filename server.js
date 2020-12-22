'use strict';

//基本モジュール
const express = require( 'express' );
const http = require( 'http' );
const socketIO = require( 'socket.io' );
const fs = require('fs');
const jsonfile = require('jsonfile');
const { Worker } = require('worker_threads');

const kuromoji = require('kuromoji');
const THRESHOLD = 1.0; //悪口かどうかを判定する閾値
const wp = '消えろ';  //悪口極性の単語
const wn = '振替'; //非悪口極性の単語
const a = 0.9;  //重み定数

//スクレイピング用のモジュール
const cheerio = require('cheerio-httpcli');
const searchEngineURL = 'https://www.google.co.jp/search';

// オブジェクト
const app = express();
const server = http.Server( app );
const io = socketIO( server );

// 定数
const PORT = process.env.PORT || 3000;
const SYSTEMNICKNAME = '管理人';
const WARNING = '特定の単語が含まれているため、その内容のメッセージは送信出来ません';
const LIMIT_OVER = 'メッセージ数の上限に達したため、1分後まで送信出来ません';

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
const filtering = async (word, roomNum, filter) => {

    //NGワードを格納する配列
    let wordArray = Array();

    //文字列比較用
    let str = '';

    //判定結果   true: 送信可能なメッセージ,  false: 送信出来ないメッセージ
    let result = true;

    //NGワードファイルを読み込む
    try {
        console.log(roomNum);
        let dir = './NG_word' + roomNum + '.json';
        wordArray = JSON.parse(fs.readFileSync(dir, 'utf-8'));
    }
    catch(e) {
        console.log(e);
    }

    //完全一致するかどうか
    for(let i=0; i<wordArray.length; i++) {

        //一致したらfalseにしてループを抜ける
        if(wordArray[i].word === word) {
            console.log('bad-word');
            result = false;
            break;
        }
    }

    //部分一致するかどうか
    for(let i=0; i<wordArray.length; i++) {

        //NGワードの配列の要素をstrに代入
        str = wordArray[i].word;
        
        //strと入力されたメッセージを比較
        if(word.indexOf(str) !== -1) {
            console.log('matched: ', str);
            result = false;
            break;
        }
    }

    //例:  str : '消えろ',  word : 'お前は消えろ'    --->   部分一致している
    //str : '消えろ',  word : 'こんにちは'      --->   部分一致していない

        if(result === true && filter === true) {

            let tokenArray = Array();

            let builder = kuromoji.builder({
                //辞書があるディレクトリを指定
                dicPath: 'node_modules/kuromoji/dict'
            });

            let tokens;

            let waruguchido;
            let total=0;
            let ans=0;

            //辞書ファイルを読み込む
            let wordDict = jsonfile.readFileSync('./value_dict.json', 'utf-8');
            let targetArray = Array(); //まだ計算していない形態素のインデックスを格納する配列
        
            // 形態素解析機を作る
            builder.build(async (err, tokenizer) => {
                // 辞書がなかった際のエラー表示
                if(err) { 
                    throw err;
                }
            
                // tokenizer.tokenize に文字列を渡して形態素解析する
                tokens = tokenizer.tokenize(word);
                console.dir(tokens);

                //返ってきたjsonオブジェクトから動詞 or 形容詞 or 名詞に当たる単語を配列に格納していく
                for (let i = 0; i < tokens.length; i++) {
                    if(tokens[i].pos === '動詞' || tokens[i].pos === '形容詞' || tokens[i].pos === '名詞') {
                        tokenArray.push(tokens[i].surface_form);
                        console.log('tokenArray:', tokenArray);
                        console.log(tokenArray.length);
                    }
                }

                //算出した悪口度が0以下であれば悪口単語ではない
                console.log(wordDict);

                for (let i = 0; i < tokenArray.length; i++) {
                    //既に悪口度を算出してある単語の場合は算出しない
                    for(let j = 0; j < wordDict.length; j++) {
                        if(tokenArray[i] === wordDict[j].word) {
                            total += wordDict[j].value;
                            console.log('matched', wordDict[j].word, tokenArray[i]);
                            break;
                        }
                        
                        if(j === wordDict.length - 1) {
                            //番兵オブジェクトに到達した(値が見つからなかった)場合はその要素のインデックスを格納
                            targetArray.push(i);
                        }
                    }
                }

                console.log(targetArray);

                for(let i=0; i<targetArray.length; i++) {

                    waruguchido = await calc_abusiveness(tokenArray[targetArray[i]]);
                    total += waruguchido;

                    //小数点第3位以下を四捨五入する
                    let value = Math.round(waruguchido * 1000) / 1000;
                    
                    //辞書ファイルに保存するオブジェクトを作成する
                    const wordObject = {
                        word: tokenArray[targetArray[i]],
                        value: value
                    };

                    //jsonオブジェクトにプッシュする
                    wordDict.push(wordObject);

                    //jsonオブジェクトを書き込む
                    jsonfile.writeFileSync('./value_dict.json', wordDict);
                }
                //平均値を算出する
                ans = total / tokenArray.length;

                //THRESHOLD : 閾値
                //悪口度が閾値以上であれば送信不可にする

                if(ans >= THRESHOLD) {
                    console.log(ans);
                    result = false;
                    io.to(roomNum).emit('calc done' , word, result);
                }
            })    
        }
    return result;
};

//web上での検索件数を基に悪口度を算出する関数
const calc_abusiveness = async (word) => {

    let c = 0;

    //各検索件数を格納する変数
    let h1,h2,h3,h4,h5,h6;

    h1 = await hit(word, wp);
    h2 = await hit(wn);
    h3 = await hit(word, wn);
    h4 = await hit(wp);
    h5 = await hit(wp);
    h6 = await hit(wn);

    c = Math.log((h1 * h2) / (h3 * h4));
    
    let f = 0;

    f = a * Math.log( h5 / h6);

    //悪口度
    let SO_PMI = 0;

    SO_PMI = c + f;

    //console.log(c);
    //console.log(f);
    console.log(SO_PMI);
    
    //console.log(h1,h2,h3,h4,h5,h6);
    
    return SO_PMI;
};

//web検索結果の件数を検索エンジンのページからスクレイピングする関数
const hit = async (w1, w2) => {

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
    
    try {
        //検索を行う
        let result = await cheerio.fetch(searchEngineURL, {q: query}).catch(() => '');
        //スクレイピングした検索件数を数値のみの形式に置き換えて格納

        let tmp = result.$('#result-stats').text().replace(/約\s(.+)\s件.+/,"$1"); 
        hit_count = parseInt(tmp.replace(/,/g, ''), 10); //検索件数の数値の中のカンマを取り除く

    } 
    catch(e) {
        console.log('no result');
        hit_count = 0;
    }

    return hit_count;
}


// グローバル変数
let iCountUser = 0; // ユーザー数
let limit = false; //タイマーの上限値であるかどうか
let messageCount = 0; //ユーザーが短時間に送信したメッセージをカウントする
let typing = false; //入力中かどうか
let socketTmp; //ソケットIDの一時変数
let socketList = {}; //ユーザのソケットIDを保持しておくオブジェクト
/*
socketList = {
    name : ニックネーム,(strNickname),
    id : ソケットID(socket.id),
}
*/
let roomList = {};; //ルーム名とそのルームのメッセージ送信の可否を保持するオブジェクト
/*
roomList = {
    roomNum: true or false, 例: 01 : true   (ルーム01は現在メッセージ送信が出来る)
}
*/

// 接続時の処理
// サーバーとクライアントの接続が確立すると
// サーバー側で、'connection'イベント
// クライアント側で、'connect'イベントが発生する

io.on('connection', (socket) => {

    //1分後にメッセージカウンタをリセットする
    let timer = setInterval(() => {
        messageCount = 0;
        
        if(limit === false) {
            limit = true;
        }
        else {
            limit = false;
        }

        //全てのルームのメッセージロックを解除する
        for (let key in roomList) {
           roomList[key] = false;
           console.log(roomList);
        }

        console.log('Timer Reseted');

    }, 60000);

    console.log('connection');

    let strNickname = '';	// コネクションごとで固有のニックネーム, イベントをまたいで使用される
    let room = '';
    let roomNum;

        // 切断時の処理
        // ・クライアントが切断したら、サーバー側では'disconnect'イベントが発生
        socket.on('disconnect', () => {
            console.log( 'disconnect' );

            clearInterval(timer);

            if(strNickname) {

                    //ユーザのソケットIDをオブジェクトから削除
                    delete socketList[strNickname];

                    // ユーザー数の更新
                    iCountUser--;

                    // メッセージオブジェクトに現在時刻を追加
                    const strNow = makeTimeString(new Date());

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

                socketList[strNickname] = socket.id;
                roomList[roomNum] = false;
                
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
                let messageArray = Array();

                let dir = 'message_list' + roomNum + '.json';

                messageArray = jsonfile.readFileSync(dir,'utf-8');

                console.log(messageArray);  

                //件数分のメッセージをクライアント側に表示させる
                for (let i = 0; i < messageArray.length; i++) {
                    io.to(socketTmp).emit('spread message', messageArray[i]);
                }

                //入室時のメッセージを全員に送信
                io.to(room).emit('spread message', objMessage);
        });

        // 新しいメッセージ受信時の処理
        // ・クライアント側のメッセージ送信時の「socket.emit( 'new message', $( '#input_message' ).val() );」に対する処理
        socket.on('new message', (strMessage, emoji, roomNum, filter) => {

                //メッセージ送信がロックされているルームの場合は送信しない
                if(roomList[roomNum] === true) {
                    //処理を中断
                    exit(1);
                }

                //入力が終了しているのでtypingをfalseにする
                typing = false;
                console.log('new message', strMessage);
                console.log('emotion:', emoji);

                // 現在時刻の文字列の作成する
                const strNow = makeTimeString(new Date());

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

                (async () => {

                    let judge = await filtering(strMessage, roomNum, filter);
                    console.log(judge);
                    /*
                    let dataArray = Array();
                    dataArray.push(strMessage,roomNum,filter);
                    const worker = new Worker('./filtering.js', {
                        workerData: dataArray
                    });

                    worker.on('message', (ans) => {
                        console.log(ans);
                        judge = ans;
                    });
                    */
                        if(judge) {
                            //NGワードではない場合
                            
                            const objMessage = {
                                strNickname: strNickname,
                                strMessage: strMessage,
                                strDate: strNow,
                                type: messageType,
                                emotion: emoji
                            };
    
                            //メンションされたメッセージかどうかを調べるための正規表現
                            //メンションの書式: @ユーザ名 メッセージ
                            let pattern = new RegExp(/^@\w*|\p{Hiragana}|\p{Katakana}|\p{Han}\s\w*|\p{Hiragana}|\p{Katakana}|\p{Han}$/);
    
                            //メンションされたメッセージの場合
                            if(pattern.test(strMessage) === true) {
                                console.log('mention');
    
                                if(limit === false) {
                                    messageCount++;
                                    console.log(messageCount);
                                }
    
                                //1分間に同じユーザへのメッセージが10件以上送信された場合
                                if(messageCount >= 10) {
    
                                    messageType = 'system';
                            
                                    const sysMessage = {
                                        strNickname: SYSTEMNICKNAME,
                                        strMessage: LIMIT_OVER, //警告メッセージの定数
                                        strDate: strNow,
                                        type: messageType
                                    };
    
                                    roomList[roomNum] = true;
                                    io.to(socket.id).emit('spread message', sysMessage);
                                }
    
                                console.log(limit);
    
                                //ユーザ名を分割して取り出す
                                let mention = strMessage.split(/\s/);
                                mention = mention[0].substring(1);
                                console.log(mention);
    
                                //対象ユーザのソケットIDを格納する
                                let targetUser = socketList[mention];
    
                                //対象ユーザにメッセージを送信する
                                io.to(targetUser).emit('spread message', objMessage);
                                io.to(socket.id).emit('spread message', objMessage);
                            }
                            else {
                                //メンションされていないメッセージの場合
                                //ルーム全員に送信
                                io.to(room).emit('spread message', objMessage);
                            }
    
                            //ルーム番号によってファイル名を指定
                            let dir = './message_list' + roomNum + '.json';
    
                            //メッセージをjsonファイルに書き込む
                            try {
                                let data = fs.readFileSync(dir, 'utf-8');
    
                                let json = JSON.parse(data);
                                json.push(objMessage);
    
                                fs.writeFileSync(dir, JSON.stringify(json), {
                                    encoding: 'utf-8', 
                                    replacer: null, 
                                    spaces: null
                                });
    
                                console.log(objMessage);
                            }
                            catch(e) {
                                console.log(e);
                            }
        
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
            let dir = './NG_word' + roomNum + '.json';

            try {
                //NGワードをファイルに追記
                let data = JSON.parse(fs.readFileSync(dir, 'utf-8'));

                const ngwordObject = {
                    word: word
                };

                data.push(ngwordObject);

                fs.writeFileSync(dir, JSON.stringify(data), {
                    encoding: 'utf-8', 
                    replacer: null, 
                    spaces: null
                });
            }
            catch(e) {
                console.log(e);
            }
        });

        //NGワード削除時の処理
        socket.on('word delete', (id, roomNum) => {
            //ルーム番号によってファイル名を指定
            let dir = './NG_word' + roomNum + '.json';

            try {
                let data = JSON.parse(fs.readFileSync(dir, 'utf-8'));
                //カンマで分割して配列に格納

                data = data.splice(id-1,1); //idで指定された要素を削除(配列の添え字を考慮する)

                fs.writeFileSync(dir, JSON.stringify(data), {
                    encoding: 'utf-8', 
                    replacer: null, 
                    spaces: null
                });
            }
            catch(e) {
                console.log(e);
            }
        });

        //現在のNGワードの参照
        socket.on('view word', (roomNum) => {

            let data = Array();

            //ルーム番号によってディレクトリを決定
            let dir = './NG_word' + roomNum + '.json';

            //NGワードファイルを読み込む
            try {
                data = JSON.parse(fs.readFileSync(dir, 'utf-8'));
                //カンマで分割して配列に格納
                io.to(roomNum).emit('view NG_word', data);
            }
            catch(e) {
                console.log(e);
            }
        });

        socket.on('message ok', (objMessage, roomNum, result) => {
            console.log(objMessage.strMessage);
            //計算が終了したらメッセージを追加し直す
            if(result === false) { 

                console.log("message ok: result false");
                //ルーム番号によってファイル名を指定
                let dir = './message_list' + roomNum + '.json';
        
                //メッセージをjsonファイルから削除する
                try {
                    let data = fs.readFileSync(dir, 'utf-8');

                    //重複した要素を削除
                    let json = JSON.parse(data);
                    for(let i=0; i<json.length; i++) {
                        if(json[i].strMessage === objMessage.strMessage) {
                            json = json.splice(i,1);
                            console.log('deleted');
                        }
                    }

                    fs.writeFileSync(dir, JSON.stringify(json), {
                        encoding: 'utf-8', 
                        replacer: null, 
                        spaces: null
                    });
                }
                catch(e) {
                    console.log(e);
                }

                objMessage.type = 'system';
                objMessage.strMessage = WARNING;
                objMessage.strNickname = SYSTEMNICKNAME;
                objMessage.emotion = '';
            }

            io.to(roomNum).emit('spread message', objMessage);
        });
});

// 公開フォルダの指定
app.use(express.static(__dirname + '/public'));

// サーバーの起動
server.listen(PORT, () => {
    console.log('Server on port %d', PORT);
});