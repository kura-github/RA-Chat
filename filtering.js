'use strict';

const { parentPort } = require('worker_threads');

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

      if(tokens.pos === '動詞' || tokens.pos === '形容詞' || tokens.pos === '') {
          console.log(tokens);
      }

  });
  */

  //算出した悪口度が0以下であれば悪口単語ではない

  let waruguchido = await calc_abusiveness(word);
  console.log(waruguchido);

  if(waruguchido >= THRESHOLD) {
      result = false;
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

  console.log(c);
  console.log(f);
  console.log(SO_PMI);
  
  console.log(h1,h2,h3,h4,h5,h6);
  
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
  let result = await cheerio.fetch(searchEngineURL, {q: query}).catch(() => '');
  //スクレイピングした検索件数を数値のみの形式に置き換えて格納

  let tmp = result.$('#result-stats').text().replace(/約\s(.+)\s件.+/,"$1"); //

  hit_count = parseInt(tmp.replace(/,/g, ''), 10); //検索件数の数値の中のカンマを取り除く

  return hit_count;
}

parentPort.on('message', (msg) => {

  parentPort.postMessage(filtering(msg));
  process.exit();

});


