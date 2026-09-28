// @ts-nocheck - this file is bundled as a browser string by Quartz.
import { overlapColor, parseTimelineDate, TIMELINE_DAY } from "../../util/timeline"
;(function () {
  var dataPromise = null
  var modal = null
  var data = null
  var mode = "active"
  var viewStart = 0
  var viewEnd = 0
  var initialStart = 0
  var initialEnd = 0
  var panState = null
  var hideTooltipTimer = null

  function basePath() {
    return (document.body.dataset.basepath || "").replace(/\/$/, "")
  }

  function sceneHref(slug) {
    return basePath() + "/" + slug.replace(/^\/+/, "")
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(basePath() + "/static/timeline.json").then(function (response) {
        if (!response.ok) throw new Error("Timeline data could not be loaded")
        return response.json()
      })
    }
    return dataPromise
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
  }

  function createModal() {
    var root = createElement("div", "timeline-modal")
    root.setAttribute("role", "dialog")
    root.setAttribute("aria-modal", "true")
    root.setAttribute("aria-labelledby", "timeline-title")
    root.innerHTML =
      '<div class="timeline-modal-backdrop" data-timeline-close></div>' +
      '<div class="timeline-dialog">' +
      '  <div class="timeline-dialog-header">' +
      '    <div><p class="timeline-kicker">World chronology</p><h2 id="timeline-title">The story, in time</h2><p data-timeline-range></p></div>' +
      '    <button class="timeline-close" type="button" data-timeline-close aria-label="Close timeline">&times;</button>' +
      "  </div>" +
      '  <div class="timeline-toolbar">' +
      '    <div class="timeline-switch" role="group" aria-label="Scene visibility"><button type="button" data-timeline-mode="active">Active scenes</button><button type="button" data-timeline-mode="previous">Previous scenes</button></div>' +
      '    <div class="timeline-legend"><span><i class="is-active"></i>Active</span><span><i class="is-previous"></i>Previous</span></div>' +
      '    <div class="timeline-zoom" role="group" aria-label="Timeline zoom"><button type="button" data-timeline-zoom="out" aria-label="Zoom out">-</button><button type="button" data-timeline-zoom="in" aria-label="Zoom in">+</button><button class="timeline-reset" type="button" data-timeline-reset>Reset view</button></div>' +
      "  </div>" +
      '  <div class="timeline-status" data-timeline-status></div>' +
      '  <div class="timeline-ruler"><div></div><div class="timeline-ruler-track" data-timeline-ruler></div></div>' +
      '  <div class="timeline-lanes" data-timeline-lanes></div>' +
      '  <div class="timeline-tooltip" data-timeline-tooltip hidden></div>' +
      "</div>"

    root.querySelectorAll("[data-timeline-close]").forEach(function (element) {
      element.addEventListener("click", closeModal)
    })
    root.querySelectorAll("[data-timeline-mode]").forEach(function (element) {
      element.addEventListener("click", function () {
        mode = element.dataset.timelineMode
        render()
      })
    })
    root.querySelectorAll("[data-timeline-zoom]").forEach(function (element) {
      element.addEventListener("click", function () {
        zoom(element.dataset.timelineZoom === "in" ? 0.5 : 2, 0.5)
      })
    })
    root.querySelector("[data-timeline-reset]").addEventListener("click", resetView)

    var lanes = root.querySelector("[data-timeline-lanes]")
    lanes.addEventListener("wheel", handleWheel, { passive: false })
    lanes.addEventListener("pointerdown", startPan)
    lanes.addEventListener("pointermove", movePan)
    lanes.addEventListener("pointerup", endPan)
    lanes.addEventListener("pointercancel", endPan)
    lanes.addEventListener("pointerleave", endPan)

    return root
  }

  function filteredScenes() {
    return (data?.scenes || []).filter(function (scene) {
      return mode === "active" ? scene.active : !scene.active
    })
  }

  function characterNames(scenes) {
    var names = {}
    scenes.forEach(function (scene) {
      scene.characters.forEach(function (character) {
        names[character] = true
      })
    })
    return Object.keys(names).sort(function (a, b) {
      return a.localeCompare(b)
    })
  }

  function laneSegments(scenes) {
    var boundaries = []
    scenes.forEach(function (scene) {
      boundaries.push(scene.startMs, scene.endMs)
    })
    boundaries = Array.from(new Set(boundaries)).sort(function (a, b) {
      return a - b
    })

    var maximum = 1
    var segments = {}
    scenes.forEach(function (scene) {
      segments[scene.id] = []
    })

    for (var index = 0; index < boundaries.length - 1; index++) {
      var start = boundaries[index]
      var end = boundaries[index + 1]
      var midpoint = start + (end - start) / 2
      var overlapping = scenes.filter(function (scene) {
        return scene.startMs <= midpoint && midpoint < scene.endMs
      })
      maximum = Math.max(maximum, overlapping.length)
      overlapping.forEach(function (scene) {
        segments[scene.id].push({ start: start, end: end, overlap: overlapping.length })
      })
    }

    return { maximum: maximum, segments: segments }
  }

  function tickStep(span) {
    var choices = [
      [60 * 60 * 1000, "time"],
      [6 * 60 * 60 * 1000, "time"],
      [TIMELINE_DAY, "day"],
      [7 * TIMELINE_DAY, "day"],
      [30 * TIMELINE_DAY, "month"],
      [365 * TIMELINE_DAY, "year"],
      [10 * 365 * TIMELINE_DAY, "year"],
      [100 * 365 * TIMELINE_DAY, "year"],
      [1000 * 365 * TIMELINE_DAY, "year"],
    ]
    for (var index = 0; index < choices.length; index++) {
      if (span / choices[index][0] <= 12) return choices[index]
    }
    return choices[choices.length - 1]
  }

  function formatTick(time, kind) {
    var date = new Date(time)
    var year = date.getUTCFullYear()
    if (kind === "time") {
      return (
        String(date.getUTCHours()).padStart(2, "0") +
        ":" +
        String(date.getUTCMinutes()).padStart(2, "0")
      )
    }
    if (kind === "year") return String(year)
    if (kind === "month")
      return String(year) + "-" + String(date.getUTCMonth() + 1).padStart(2, "0")
    return (
      String(date.getUTCDate()).padStart(2, "0") +
      " " +
      String(date.getUTCMonth() + 1).padStart(2, "0")
    )
  }

  function renderRuler() {
    var ruler = modal.querySelector("[data-timeline-ruler]")
    ruler.innerHTML = ""
    var choice = tickStep(viewEnd - viewStart)
    var step = choice[0]
    var first = Math.floor(viewStart / step) * step
    for (var time = first; time <= viewEnd + step; time += step) {
      if (time < viewStart) continue
      var tick = createElement("span", "timeline-tick", formatTick(time, choice[1]))
      tick.style.left = ((time - viewStart) / (viewEnd - viewStart)) * 100 + "%"
      ruler.appendChild(tick)
    }
  }

  function showTooltip(clientX, clientY, scenes, time) {
    var active = scenes.filter(function (scene) {
      return scene.startMs <= time && time < scene.endMs
    })
    if (active.length === 0) return hideTooltip()

    var tooltip = modal.querySelector("[data-timeline-tooltip]")
    tooltip.innerHTML = ""
    tooltip.appendChild(createElement("p", "", "Scenes at this moment"))
    var list = createElement("ul")
    active.forEach(function (scene) {
      var item = createElement("li")
      var link = createElement("a", "", scene.name)
      link.href = sceneHref(scene.slug)
      item.appendChild(link)
      list.appendChild(item)
    })
    tooltip.appendChild(list)
    tooltip.hidden = false
    var left = Math.min(clientX + 14, window.innerWidth - tooltip.offsetWidth - 12)
    var top = Math.min(clientY + 14, window.innerHeight - tooltip.offsetHeight - 12)
    tooltip.style.left = Math.max(12, left) + "px"
    tooltip.style.top = Math.max(12, top) + "px"
    clearTimeout(hideTooltipTimer)
  }

  function hideTooltip() {
    clearTimeout(hideTooltipTimer)
    hideTooltipTimer = setTimeout(function () {
      var tooltip = modal?.querySelector("[data-timeline-tooltip]")
      if (tooltip) tooltip.hidden = true
    }, 90)
  }

  function addSceneBlock(track, scene, laneScenes, segments, maximum) {
    if (scene.endMs <= viewStart || scene.startMs >= viewEnd) return
    var start = Math.max(scene.startMs, viewStart)
    var end = Math.min(scene.endMs, viewEnd)
    var block = createElement(
      "a",
      "timeline-event-block " + (scene.active ? "is-active" : "is-previous"),
    )
    block.href = sceneHref(scene.slug)
    block.setAttribute("aria-label", scene.name)
    block.style.left = ((start - viewStart) / (viewEnd - viewStart)) * 100 + "%"
    block.style.width = Math.max(0.18, ((end - start) / (viewEnd - viewStart)) * 100) + "%"
    ;(segments[scene.id] || []).forEach(function (segment) {
      var segmentStart = Math.max(segment.start, viewStart, scene.startMs)
      var segmentEnd = Math.min(segment.end, viewEnd, scene.endMs)
      if (segmentEnd <= segmentStart) return
      var part = createElement("span", "timeline-event-segment")
      part.style.backgroundColor = overlapColor(
        segment.overlap,
        maximum,
        data.config.maxOverlapForRed,
      )
      part.style.left = ((segmentStart - scene.startMs) / (scene.endMs - scene.startMs)) * 100 + "%"
      part.style.width = ((segmentEnd - segmentStart) / (scene.endMs - scene.startMs)) * 100 + "%"
      block.appendChild(part)
    })
    block.addEventListener("pointermove", function (event) {
      var rect = track.getBoundingClientRect()
      var ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      showTooltip(
        event.clientX,
        event.clientY,
        laneScenes,
        viewStart + ratio * (viewEnd - viewStart),
      )
    })
    block.addEventListener("pointerleave", hideTooltip)
    track.appendChild(block)
  }

  function render() {
    if (!modal || !data) return
    var scenes = filteredScenes()
    var characters = characterNames(scenes)
    var lanes = [{ label: "All scenes", scenes: scenes }]
    characters.forEach(function (character) {
      lanes.push({
        label: character,
        scenes: scenes.filter(function (scene) {
          return scene.characters.includes(character)
        }),
      })
    })

    modal.querySelector("[data-timeline-range]").textContent = formatRange(viewStart, viewEnd)
    modal.querySelector("[data-timeline-status]").textContent = scenes.length
      ? scenes.length +
        " scene" +
        (scenes.length === 1 ? "" : "s") +
        " shown across " +
        lanes.length +
        " timeline" +
        (lanes.length === 1 ? "" : "s")
      : "No scenes have dates in this view yet."
    modal.querySelectorAll("[data-timeline-mode]").forEach(function (button) {
      button.classList.toggle("is-selected", button.dataset.timelineMode === mode)
      button.setAttribute("aria-pressed", button.dataset.timelineMode === mode ? "true" : "false")
    })
    renderRuler()

    var laneContainer = modal.querySelector("[data-timeline-lanes]")
    laneContainer.innerHTML = ""
    if (lanes.length === 1 && scenes.length === 0) {
      laneContainer.appendChild(
        createElement(
          "p",
          "timeline-empty",
          "Add timeline-start and timeline-duration to a scene to place it here.",
        ),
      )
      return
    }

    lanes.forEach(function (lane) {
      var row = createElement("div", "timeline-lane-row")
      var label = createElement("div", "timeline-lane-label")
      label.appendChild(createElement("strong", "", lane.label))
      label.appendChild(
        createElement(
          "small",
          "",
          String(lane.scenes.length) + " scene" + (lane.scenes.length === 1 ? "" : "s"),
        ),
      )
      var track = createElement("div", "timeline-track")
      row.appendChild(label)
      row.appendChild(track)
      var prepared = laneSegments(lane.scenes)
      lane.scenes.forEach(function (scene) {
        addSceneBlock(track, scene, lane.scenes, prepared.segments, prepared.maximum)
      })
      laneContainer.appendChild(row)
    })
  }

  function formatRange(start, end) {
    var startDate = new Date(start)
    var endDate = new Date(end - TIMELINE_DAY)
    return (
      startDate.getUTCFullYear() +
      "-" +
      String(startDate.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(startDate.getUTCDate()).padStart(2, "0") +
      " to " +
      endDate.getUTCFullYear() +
      "-" +
      String(endDate.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(new Date(end - TIMELINE_DAY).getUTCDate()).padStart(2, "0")
    )
  }

  function resetView() {
    viewStart = initialStart
    viewEnd = initialEnd
    render()
  }

  function zoom(factor, anchorRatio) {
    var span = viewEnd - viewStart
    var nextSpan = Math.max(
      60 * 60 * 1000,
      Math.min(data.domainEnd - data.domainStart, span * factor),
    )
    var anchor = viewStart + span * anchorRatio
    viewStart = anchor - nextSpan * anchorRatio
    viewEnd = anchor + nextSpan * (1 - anchorRatio)
    clampView()
    render()
  }

  function clampView() {
    var span = viewEnd - viewStart
    if (viewStart < data.domainStart) {
      viewStart = data.domainStart
      viewEnd = viewStart + span
    }
    if (viewEnd > data.domainEnd) {
      viewEnd = data.domainEnd
      viewStart = viewEnd - span
    }
  }

  function handleWheel(event) {
    event.preventDefault()
    var rect = event.currentTarget.getBoundingClientRect()
    var ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    zoom(event.deltaY > 0 ? 1.25 : 0.8, ratio)
  }

  function startPan(event) {
    if (event.target.closest("a")) return
    panState = { x: event.clientX, start: viewStart, end: viewEnd, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePan(event) {
    if (!panState) return
    var distance = event.clientX - panState.x
    if (Math.abs(distance) > 3) panState.moved = true
    var span = panState.end - panState.start
    var delta = (distance / event.currentTarget.getBoundingClientRect().width) * span
    viewStart = panState.start - delta
    viewEnd = panState.end - delta
    clampView()
    render()
  }

  function endPan(event) {
    if (!panState) return
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    panState = null
  }

  function closeModal() {
    if (!modal) return
    modal.remove()
    modal = null
    document.body.classList.remove("timeline-is-open")
  }

  function openModal() {
    if (modal) return
    modal = createModal()
    document.body.appendChild(modal)
    document.body.classList.add("timeline-is-open")
    var close = modal.querySelector("[data-timeline-close]")
    close.focus()
    loadData()
      .then(function (loaded) {
        data = loaded
        data.domainStart = parseTimelineDate(data.config.calendar.start)
        data.domainEnd = parseTimelineDate(data.config.calendar.end) + TIMELINE_DAY
        initialStart = parseTimelineDate(data.config.initialWindow.start)
        initialEnd = parseTimelineDate(data.config.initialWindow.end) + TIMELINE_DAY
        viewStart = initialStart
        viewEnd = initialEnd
        render()
      })
      .catch(function () {
        modal.querySelector("[data-timeline-status]").textContent =
          "Timeline data could not be loaded."
        modal
          .querySelector("[data-timeline-lanes]")
          .appendChild(
            createElement(
              "p",
              "timeline-empty",
              "Try rebuilding the site, then open the timeline again.",
            ),
          )
      })
  }

  function bindLaunchers() {
    document.querySelectorAll("[data-timeline-open]").forEach(function (button) {
      if (button.dataset.timelineBound) return
      button.dataset.timelineBound = "true"
      button.addEventListener("click", openModal)
    })
  }

  document.addEventListener("nav", function () {
    closeModal()
    bindLaunchers()
  })
  document.addEventListener("render", bindLaunchers)
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal) closeModal()
  })
  bindLaunchers()
})()
