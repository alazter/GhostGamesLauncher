interface Job<T> {
  key: string
  run: () => Promise<T>
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}
/** Detail requests move ahead of queued badges; running reads are never duplicated. */
export class DrmLookupQueue<T> {
  private jobs = new Map<string, Job<T>>()
  private waiting: Job<T>[] = []
  private active = 0
  constructor(private concurrency = 2) {}
  run(key: string, work: () => Promise<T>, priority = false): Promise<T> {
    const existing = this.jobs.get(key)
    if (existing) {
      const index = this.waiting.indexOf(existing)
      if (priority && index >= 0) {
        this.waiting.splice(index, 1)
        this.waiting.unshift(existing)
      }
      return existing.promise
    }
    let resolve!: (value: T) => void, reject!: (error: unknown) => void
    const promise = new Promise<T>((ok, fail) => {
      resolve = ok
      reject = fail
    })
    const job = { key, run: work, promise, resolve, reject }
    this.jobs.set(key, job)
    if (priority) this.waiting.unshift(job)
    else this.waiting.push(job)
    this.pump()
    return promise
  }
  private pump() {
    while (this.active < this.concurrency && this.waiting.length) {
      const job = this.waiting.shift()!
      this.active++
      void Promise.resolve()
        .then(job.run)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.jobs.delete(job.key)
          this.active--
          this.pump()
        })
    }
  }
}
