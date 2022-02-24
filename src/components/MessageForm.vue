<template>
  <form id="message-form" action="">
    Nickname : <span id="nickname">{{ nickName }}</span> Room : <span id="room">{{ room }}</span>
    <input type="text" id="input_message" autocomplete="off" placeholder="Message"/>
    <button type="submit" class="btn-xs btn-success" id="send_button">送信</button>
  </form>
</template>

<script>
export default {
    props: {
        nickName: String,
        room:   Number
    }
}
</script>

<style>

</style>