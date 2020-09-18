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
            socket.emit('new message', $( '#input_message').val(), $('input[name="emotion"]:checked').val());

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


$('#emotion-set').click(() => {
    var target = $(event.target).val();
    console.log(target);

    switch (target) {
        case 'laugh':
            $('input:radio[name="emotion"]').val(["laugh"]);
            break;

        case 'smile':
            $('input:radio[name="emotion"]').val(["smile"]);
            break;

        case 'surprise':
            $('input:radio[name="emotion"]').val(["surprise"]);
            break;

        case 'angry':
            $('input:radio[name="emotion"]').val(["angry"]);
            break;
        
        case 'cry':
            $('input:radio[name="emotion"]').val(["cry"]);
            break;
        
        default:
            break;
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

        var mark;
        var element;
        var box;

        switch (objMessage.emotion) {
            case 'laugh':
                mark = '<td id="image_area"><img src="./mark_face_laugh.png"></td>';
                break;

            case 'smile':
                mark = '<td id="image_area"><img src="./mark_face_smile.png"></td>';
                break;

            case 'surprise':
                mark = '<td id="image_area"><img src="./mark_face_odoroki.png"></td>';
                break;

            case 'angry':
                mark = '<td id="image_area"><img src="./mark_face_angry.png"></td>';
                break;

            case 'cry':
                mark = '<td id="image_area"><img src="./mark_face_cry.png"></td>';
                break;

            default:
                mark = '<td></td>';
                break;
        }

        
        switch (objMessage.type) {
            case 'system':
                element = '<td class="system_message">' + strMessage + '</td>';
                break;

            case 'send':
                element = '<td class="send_message">' + strMessage + '</td>';
                break;

            case 'receive':
                element = '<td class="receive_message">' + strMessage + '</td>';
                break;

            default:
                break;
        }

        box = '<tr>' + mark + element + '</tr>';
        console.log(box);

        $('tbody').append(box);    // リストの一番下に追加
} );