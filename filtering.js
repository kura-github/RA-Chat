'use strict';

const { parentPort } = require('worker_threads');
const { workerData } = require('worker_threads');
const kuromoji = require('kuromoji');
const jsonfile = require('jsonfile');
const fs = require('fs');
const THRESHOLD = 0; //悪口かどうかを判定する閾値
const wp = '消えろ';  //悪口極性の単語
const wn = '振替'; //非悪口極性の単語
const a = 0.9;  //重み定数

//スクレイピング用のモジュール
const cheerio = require('cheerio-httpcli');
const searchEngineURL = 'https://www.google.co.jp/';

console.log('strMessage:' + workerData[0]);
console.log('roomNum:' + workerData[1]);
console.log('filter:' + workerData[2]);


//NGワードとの文字列比較を行う
const filtering = async (word, roomNum, filter) => {

    console.log('now');

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
            console.log('matched: ' + str);
            result = false;
            break;
        }
    }

    /*
    例:  str : '消えろ',  word : 'お前は消えろ'    --->   部分一致している
         str : '消えろ',  word : 'こんにちは'      --->   部分一致していない
    */

    if(result === true && filter === true) {
        let tokenArray = Array();

        let builder = kuromoji.builder({
            //辞書があるディレクトリを指定
            dicPath: 'node_modules/kuromoji/dict'
        });

        let tokens;
    
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
                    console.log(tokenArray);
                    console.log(tokenArray.length);
                }
            }

            //算出した悪口度が0以下であれば悪口単語ではない

            //辞書ファイルを読み込む
            let wordDict = jsonfile.readFileSync('./value_dict.json', 'utf-8');

            for (let i = 0; i < wordDict.length; i++) {
                //既に悪口度を算出してある単語の場合は算出しない
                for(let j = 0; j < tokenArray.length; j++) {
                    if(wordDict[i].word === tokenArray[j]) {
                        waruguchido = wordDict[i].value;
                        console.log('119:' + waruguchido);      
                    }
                    else {
                        //悪口度をまだ算出していない単語の場合は算出する
                        waruguchido = await calc_abusiveness(tokenArray[j]);
            
                        console.log(tokenArray[j]);
                        
                        //小数点第3位以下を四捨五入する
                        let value = Math.round(waruguchido * 1000) / 1000;
            
                        //辞書ファイルに保存するオブジェクトを作成する
                        const wordObject = {
                            word: tokenArray[j],
                            value: value
                        };
            
                        //jsonオブジェクトにプッシュする
                        wordDict.push(wordObject);
            
                        //jsonオブジェクトを書き込む
                        jsonfile.writeFileSync('./value_dict.json', wordDict);
                        continue;
                    }
                }
            }
        });

        //THRESHOLD : 閾値
        //悪口度が閾値以上であれば送信不可にする

        let waruguchido = await calc_abusiveness(word);
        parentPort.postMessage(waruguchido);

        if(waruguchido >= THRESHOLD) {
            result = false;
        }
    }
    //判定結果を返す
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

    console.log(c);
    console.log(f);
    console.log(SO_PMI);
    
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
    
    //検索を行う
    let result = await cheerio.fetch(searchEngineURL, {q: query}).catch(() => '');
    //スクレイピングした検索件数を数値のみの形式に置き換えて格納

    let tmp = result.$('#result-stats').text().replace(/約\s(.+)\s件.+/,"$1"); //

    hit_count = parseInt(tmp.replace(/,/g, ''), 10); //検索件数の数値の中のカンマを取り除く

    return hit_count;
}

(async () => {
    let ans = await filtering(workerData[0], workerData[1], workerData[2]);
    console.log('filtering.js : 229');
    parentPort.postMessage(ans);
    process.exit();
})();
