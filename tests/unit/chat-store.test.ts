import { inMemoryChatStore } from '@/lib/chat/store'
import { describeChatStore } from '../shared/chat-store-contract'

describeChatStore('in memory', async () => inMemoryChatStore())
