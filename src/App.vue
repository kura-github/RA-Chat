<style>

</style>

<template>
    <div id="chat-screen">
            <div id="message-list">
                <!--  ここにメッセージが動的に追加される  -->
            </div>
        
            <div id="emotion-value">
                <input type="radio" name="emotion" value="laugh">
                <input type="radio" name="emotion" value="smile" checked>
                <input type="radio" name="emotion" value="surprise">
                <input type="radio" name="emotion" value="angry">
                <input type="radio" name="emotion" value="cry">
            </div>
        
            <div id="emotion-set">
                <button id="laugh" value="laugh"></button>
                <button id="smile" value="smile"></button>
                <button id="surprise" value="surprise"></button>
                <button id="angry" value="angry"></button>
                <button id="cry" value="cry"></button>
            </div>
        
            
        </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent ({
    name: 'App',
    setup() {
        return {
            helloText: 'Hello,World!'
        }
    }
})
</script>