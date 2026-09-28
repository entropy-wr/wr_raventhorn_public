import { QuartzComponent, QuartzComponentConstructor } from "./types"

const Timeline: QuartzComponent = () => {
  return (
    <section class="timeline-launcher" aria-labelledby="timeline-launcher-title">
      <div>
        <p class="timeline-kicker">World chronology</p>
        <h2 id="timeline-launcher-title">The story, in time</h2>
        <p>Trace every scene across the long calendar, then follow each character path.</p>
      </div>
      <button class="timeline-open" type="button" data-timeline-open>
        <span>Explore the timeline</span>
        <span aria-hidden="true">&#8599;</span>
      </button>
    </section>
  )
}

export default (() => Timeline) satisfies QuartzComponentConstructor
