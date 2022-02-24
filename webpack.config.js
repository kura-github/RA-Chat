const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
  devtool: "inline-source-map",
  // モジュールバンドルを行う起点となるファイルの指定
  // 指定できる値としては、ファイル名の文字列や、それを並べた配列やオブジェクト
  // 下記はオブジェクトとして指定した例
  entry: {
    bundle: './src/index.ts'
  },
  // モジュールバンドルを行った結果を出力する場所やファイル名の指定
  output: {
    path: path.join(__dirname, 'dist'), // "__dirname"はファイルが存在するディレクトリ
    filename: '[name].js'  // [name]はentryで記述した名前（この設定ならbundle）
  },
  // import文でファイル拡張子を書かずに名前解決するための設定
  // 例...「import World from './world'」と記述すると"world.ts"という名前のファイルをモジュールとして探す
  resolve: {
    extensions:['.ts','.js','.vue'] // Reactの.tsxや.jsxの拡張子も扱いたい場合は配列内に追加する
  },
  devServer: {
    static: path.join(__dirname, 'dist'), // webpack-dev-serverの公開フォルダ
    open: true // サーバー起動時にブラウザを開く
  },
  // モジュールに適用するルールの設定（ローダーの設定を行う事が多い）
  module: {
    rules: [
      {
        //vueのloader設定
        test: /\.vue$/,
        loader: "vue-loader"
      },
      {
        //cssのloader設定
        test: /\.css$/,
        use:[
          "style-loader",
          "css-loader"
        ]
      },
      {
        // 拡張子が.tsのファイルに対してTypeScriptコンパイラを適用する
        // Reactで用いる.tsxの拡張子にも適用する場合は test:/\.(ts|tsx)$/,
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
            //vueをtypescriptとして監視する
            appendTsSuffixTo: [/\.vue$/]
        }
      }
    ]
  },
  //vue-loader v15以上を使う場合に必要
  plugins:[new VueLoaderPlugin()]
}