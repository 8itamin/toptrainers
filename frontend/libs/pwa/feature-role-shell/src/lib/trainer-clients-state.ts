export class RequestSelection {
  private generation = 0;
  next() {
    return ++this.generation;
  }
  current(generation: number) {
    return generation === this.generation;
  }
}
export function issueKey(card: string, program: string, date: string) {
  return `${card}:${program}:${date}`;
}
