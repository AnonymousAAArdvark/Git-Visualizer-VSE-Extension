<script lang="ts">
    import { onMount } from "svelte";

    let text = "";

    onMount(() => {
        // Listen for messages from the extension
        window.addEventListener("message", (event) => {
            const message = event.data;
            switch (message.type) {
                
            }
        });
    });
</script>
<h1>testing testing</h1>