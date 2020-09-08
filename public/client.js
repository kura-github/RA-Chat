// クライアントからサーバーへの接続要求
const socket = io.connect();

// 接続時の処理
// ・サーバーとクライアントの接続が確立すると、
// 　サーバー側で、'connection'イベント
// 　クライアント側で、'connect'イベントが発生する
socket.on('connect', () => {
    console.log( 'connect' );
});


// 「Join」ボタンを押したときの処理
$( '#join-form' ).submit(() => {
        console.log( '#input_nickname :', $( '#input_nickname' ).val() );

        if($('#input_nickname').val())
        {
            // サーバーに、イベント名'join' で入力テキストを送信

            //$("#pgss").css({'width':'100%'});
            
            socket.emit( 'join', $( '#input_nickname' ).val() , $('#input_room').val());

            $( '#nickname' ).html( $( '#input_nickname' ).val() );
            $('#room').html($('#input_room').val());
            $( '#join-screen' ).hide();
            $( '#chat-screen' ).show();
        }

        return false;   // フォーム送信はしない
});

// 「Send」ボタンを押したときの処理
$( 'form' ).submit(() => {

        console.log( '#input_message :', $( '#input_message' ).val() );

        if( $('#input_message').val()) {
            // サーバーに、イベント名'new message' で入力テキストを送信
            socket.emit('new message', $( '#input_message').val());

            $('#input_message').val('');    // テキストボックスを空にする
        }
        return false;   // フォーム送信はしない
});

$('#leave_button').click(() => {
    console.log('leaved');
    socket.emit('disconnect');
    location.href = 'index.html';
});


$('#input_message').on('input', () => {
    socket.emit('typing');
});

$('#regist_button').click(() => {
    //入力ダイアログからの文字列を格納する
    
    let word = prompt('追加するNGワードを入力して下さい');

    if(word) {
        //カンマを付加
        word += ',';
        socket.emit('word regist', word);
        console.log('registerd', word);
        alert('NGワードが追加されました');
    }
    else {
        alert('ワードを入力して下さい');
    }
});

// サーバーからのメッセージ拡散に対する処理
// ・サーバー側のメッセージ拡散時の「io.emit( 'spread message', strMessage );」に対する処理
socket.on('spread message', ( objMessage ) => {
        //console.log( 'spread message :', strMessage );
        console.log( 'spread message :', objMessage );

        // メッセージの整形
        //const strText = objMessage.strDate + ' - ' + objMessage.strMessage;
        const strMessage = objMessage.strDate + ' - [' + objMessage.strNickname + '] ' + objMessage.strMessage;

        // 拡散されたメッセージをメッセージリストに追加
        //const li_element = $( '<li>' ).text( strMessage );

        var element;
        var box;

        if(objMessage.type === 'system') {
            element = $('<p class="system_message"></p>').text( strMessage );
        }
        else if(objMessage.type === 'send') {
            element = $('<p class="send_message"></p>').text( strMessage );
        }
        else {
            element = $('<p class="receive_message"></p>').text(strMessage);
        }
        
        box = $('<div class="box"></div>').html(element);
        //$( '#message_list' ).prepend( li_element ); // リストの一番上に追加
        $('#message_list').append(box);    // リストの一番下に追加
} );

/*
socket.on('receive message', (objMessage) => {
    console.log('receive message :', objMessage);

    const message = objMessage.strDate + ' - [' + objMessage.strNickname + '] ' + objMessage.strMessage;
    let li_element = $('<li>').addClass("user_message").text(message);
    $('#message_list').append(li_element);
});
*/
