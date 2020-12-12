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
            
            socket.emit( 'join', $( '#input_nickname' ).val() , $('#input_room').val());

            $( '#nickname' ).html( $( '#input_nickname' ).val() );
            $('#room').html($('#input_room').val());

            
            $('#join-screen').hide();
            $('#chat-screen').show();
        }

        return false;   // フォーム送信はしない
});

// 「Send」ボタンを押したときの処理
$( 'form' ).submit(() => {

        console.log( '#input_message :', $( '#input_message' ).val() );

        if( $('#input_message').val()) {
            // サーバーに、イベント名'new message' で入力テキストを送信
            socket.emit('new message', $( '#input_message').val(), $('input[name="emotion"]:checked').val(), $('#room').text());

            $('#input_message').val('');    // テキストボックスを空にする
        }

        return false;   // フォーム送信はしない
});

$('#leave_button').click(() => {
    console.log('leaved');
    socket.emit('disconnect');

    let ans = confirm('このチャットルームを退室しますか?');

    if(ans) {
        location.href = 'index.html';
    }
    
});
    
$('#input_message').on('input', () => {
    socket.emit('typing', $('#room').text());
});

$('#regist_button').click(() => {
    //入力ダイアログからの文字列を格納する
    
    let word = prompt('追加するNGワードを入力して下さい');

    if(word) {
        //カンマを付加
        word += ',';
        socket.emit('word regist', word, $('#room').text());
        console.log('registerd', word);
        alert('NGワードが追加されました');
    }

});

$('#delete_button').click(() => {
    //入力ダイアログからの文字列を格納する
    
    let id = prompt('削除するNGワードの番号を入力して下さい');

    if(id) {
        //カンマを付加
        socket.emit('word delete', id, $('#room').text());
        console.log('deleted', id);
        alert('NGワードが削除されました');
    }

});

$('#view_button').click(() => {
    socket.emit('view word', $('#room').text());
    console.log($('#room').val());
});

$('#emotion-set').click(() => {
    let target = $(event.target).val();
    let tmp = '#' + target;
    let buttonArray = ['#laugh','#smile','#surprise', '#angry', '#cry'];

    //クリックしたボタンによってラジオボタンの値を変更する
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

    $(tmp).css('opacity', 0.3);

    for(let i=0; i < buttonArray.length; i++) {
        if(tmp !== buttonArray[i]) {
            let selector = buttonArray[i];
            $(selector).css('opacity', 1);
        }
    }
});

// サーバーからのメッセージ拡散に対する処理
// ・サーバー側のメッセージ拡散時の「io.emit( 'spread message', strMessage );」に対する処理
socket.on('spread message', ( objMessage ) => {
        
        const objEmotion = {
            laugh    : '<div class="image_area"><img src="./mark_face_laugh.png"><div class="mask"><div class="caption">笑顔</div></div></div>' ,
            smile    : '<div class="image_area"><img src="./mark_face_smile.png"><div class="mask"><div class="caption">微笑み</div></div></div>',
            surprise : '<div class="image_area"><img src="./mark_face_odoroki.png"><div class="mask"><div class="caption">驚き</div></div></div>',
            angry    : '<div class="image_area"><img src="./mark_face_angry.png"><div class="mask"><div class="caption">怒り</div></div></div>',
            cry      : '<div class="image_area"><img src="./mark_face_cry.png"><div class="mask"><div class="caption">悲しみ</div></div></div>',
        };

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
                mark = objEmotion.laugh;
                break;

            case 'smile':
                mark = objEmotion.smile;
                break;

            case 'surprise':
                mark = objEmotion.surprise;
                break;

            case 'angry':
                mark = objEmotion.angry;
                break;

            case 'cry':
                mark = objEmotion.cry;
                break;

            default:
                mark = ' ';
                break;
        }
     
        switch (objMessage.type) {
            case 'system':
                element = '<div class="system_message">' + strMessage + '</div>';
                box = '<div class="box">' + mark + element + '</div>';
                break;

            case 'send':
                element = '<div class="send_message">' + strMessage + '</div>';
                box = '<div class="box">' + mark + element + '</div>';
                break;

            case 'receive':
                element = '<div class="receive_message">' + strMessage + '</div>';
                box = '<div class="box">' + element + mark + '</div>';
                break;

            default:
                break;
        }
        console.log(box);

        $('#message-list').append(box);    // リストの一番下に追加
});

socket.on('view NG_word', (wordArray) => {

    let message = '';

    for (let i = 0; i < wordArray.length - 1; i++) {
        message += i + 1 + '. ';
        message += wordArray[i];
        message += '\n';
    }

    alert('現在のNGワード\n' + message);
});