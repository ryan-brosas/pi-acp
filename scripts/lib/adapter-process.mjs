export function isAdapterProcessArgs(args) {
  if (/(?:^|\s)["']?\S*\/dist\/index\.js["']?(?:\s|$)/.test(args)) return true
  return /(?:^|\s)["']?(?:\S*\/)?pi-acp(?:-jetbrain)?["']?(?:\s|$)/.test(args)
}
