<script setup>
import { ref, useId } from 'vue'

// "Draft with AI": an optional instruction box and a button that asks the
// server for a draft. The page decides what to do with it (fill its fields)
// and how to undo it; this component only runs the request and reports back.
const props = defineProps({
  // async (instructions) => { draft, remainingToday }
  request: { type: Function, required: true },
  // What the AI will see, e.g. "the event's details".
  sees: { type: String, required: true },
  placeholder: { type: String, default: '' },
  // Whether the page currently holds an AI draft that can be undone.
  canUndo: { type: Boolean, default: false },
})
const emit = defineEmits(['drafted', 'undo'])

const id = useId()
const instructions = ref('')
const busy = ref(false)
const status = ref('')
const failed = ref(false)

// The page moves focus to the filled field, and screen readers drop a status
// message that changes at the same moment; so the message is set just after.
function announce(message, isError = false) {
  status.value = ''
  failed.value = isError
  setTimeout(() => {
    status.value = message
  }, 600)
}

async function draft() {
  busy.value = true
  status.value = 'Writing a draft...'
  failed.value = false
  try {
    const { draft: result, remainingToday } = await props.request(instructions.value.trim())
    emit('drafted', result)
    announce(`AI draft added - read it and change anything before you use it. ${remainingToday} AI drafts left today.`)
  } catch (error) {
    announce(error.message, true)
  } finally {
    busy.value = false
  }
}

function undo() {
  emit('undo')
  announce('AI draft removed; your previous text is back.')
}
</script>

<template>
  <div class="ai-panel border rounded-3 p-3">
    <label class="form-label small fw-semibold mb-1" :for="`${id}-instructions`">
      Draft with AI <span class="fw-normal text-muted">(optional instructions)</span>
    </label>
    <textarea
      :id="`${id}-instructions`"
      v-model="instructions"
      class="form-control form-control-sm"
      rows="2"
      maxlength="500"
      :placeholder="placeholder"
      :aria-describedby="`${id}-hint`"
    ></textarea>
    <p :id="`${id}-hint`" class="form-text mb-2">
      The AI (Google Gemini) sees only {{ sees }} and these instructions - never anyone's registration details.
      Nothing is sent or saved until you choose to.
    </p>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <button class="btn btn-outline-success btn-sm" type="button" :disabled="busy" @click="draft">
        {{ busy ? 'Writing...' : 'Draft with AI' }}
      </button>
      <button v-if="canUndo" class="btn btn-link btn-sm" type="button" :disabled="busy" @click="undo">
        Undo AI draft
      </button>
    </div>
    <p class="small mt-2 mb-0" :class="failed ? 'text-danger' : 'text-muted'" role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
.ai-panel {
  background: #f6faf7;
}
</style>
