// フロントエンドはpublic/index.htmlを使用
// Next.jsはAPIルートのみ担当

import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/index.html')
}
