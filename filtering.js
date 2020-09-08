'use strict';

const kuromoji = require('kuromoji');

//NGワードとの文字列比較を行う
const filtering = (word) => {

  //NGワードを格納する配列
  let wordArray = Array();

  //文字列比較用
  let str = '';

  //NGワードファイルを格納する一時変数
  let data;

  //判定結果   true: 送信可能なメッセージ,  false: 送信出来ないメッセージ
  let result = true;

  //NGワードファイルを読み込む(同期)
  try {
      data = fs.readFileSync('./NG_word.txt', 'utf-8');
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
  
  return result;
};