const CONFIG = {
  CLAW: {
    INITIAL_POSITION: { x: 10, y: -260 },
    SHADOW_INITIAL_POSITION: { x: 10, y: -180 },
    MOVEMENT: {
      RIGHT: { speed: 8, maxX: 280 },
      UP: { speed: 4, maxY: -380 },
      DOWN: { speed: 4 },
      LEFT: { speed: 8, targetX: 10 },
    },
    SHADOW: {
      INITIAL_SCALE: 0.3,
      TARGET_SCALE: 0.7,
      SCALE_STEPS: 50,
      OPACITY_THRESHOLD: 120,
    },
  },
  MACHINE: {
    BOUNDS: {
      left: 80,
      right: 360,
      top: 80,
      bottom: 320,
    },
  },
  PLUSHIE: {
    GRAB_RANGE: 80,
    DROP_OFFSET: 280,
    COLLECTION: {
      SCALE: 2,
      CENTER_Y_OFFSET: 2.5,
    },
    GRAB: {
      CLAW_WIDTH: 30,
      CLAW_HEIGHT: 20,
      SWEET_SPOT: 25,
      MIN_GRAB_CHANCE: 0.5,
      MAX_GRAB_CHANCE: 0.98,
      DEBUG: true,
      VISUAL_FEEDBACK: true,
      ALIGNMENT_WEIGHT: 0.85,
    },
  },
  ANIMATION: {
    DURATION: {
      CLAW: 500,
      COLLECTION: 500,
      FADE_OUT: 300,
    },
    WIGGLE: {
      AMPLITUDE: 3,
      SPEED: 0.15,
      PHASE: 0.5,
    },
  },
}

document.addEventListener('DOMContentLoaded', function () {
  const elements = {
    machine: document.querySelector('.machine'),
    machineInside: document.querySelector('.machine-inside'),
    plushiesContainer: document.querySelector('.plushies'),
    plushieExhibit: document.querySelector('.plushie-exhibit'),
    clawArm: document.getElementById('claw-arm'),
    clawLeft: document.getElementById('claw-left'),
    clawRight: document.getElementById('claw-right'),
    shadow: document.getElementById('shadow'),
    shadowOne: document.getElementById('shadow-one'),
    shadowTwo: document.getElementById('shadow-two'),
    buttonRight: document.getElementById('button-right'),
    buttonTop: document.getElementById('button-top'),
    plushies: [],
  }

  const state = {
    targetPlushie: null,
    collectedNumber: 0,
    isMoving: false,
    isGrabbing: false,
    moveInterval: null,
    currentButton: null,
    clawPosition: { ...CONFIG.CLAW.INITIAL_POSITION },
    shadowPosition: { ...CONFIG.CLAW.SHADOW_INITIAL_POSITION },
    plushieOffset: null,
    droppedPlushies: [],
  }

  const plushieTypes = ['bear', 'duck', 'dog', 'cat']
  const plushieVariants = {
    bear: ['bear.png', 'bear_1.png', 'bear_2.png'],
    duck: ['duck.png', 'duck_1.png', 'duck_2.png', 'duck_3.png'],
    dog: ['dog.png', 'dog_1.png', 'dog_2.png'],
    cat: ['cat.png', 'cat_1.png', 'cat_2.png'],
  }

  const randomN = (min, max) =>
    Math.round(min - 0.5 + Math.random() * (max - min + 1))

  const getElementPosition = (element) => {
    const rect = element.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  const resetAnimation = (element) => {
    element.style.animation = 'none'
    void element.offsetWidth
  }

  class Button {
    constructor({ element, isLocked = false, pressAction, releaseAction }) {
      this.el = element
      this.isLocked = isLocked
      this.pressAction = pressAction
      this.releaseAction = releaseAction

      this.el.addEventListener('mousedown', this.pressAction)
      this.el.addEventListener('mouseup', this.releaseAction)
      this.el.addEventListener('mouseleave', this.releaseAction)

      if (!isLocked) this.activate()
    }

    activate() {
      this.isLocked = false
      this.el.style.pointerEvents = 'auto'
      this.el.style.opacity = '1'
    }

    deactivate() {
      this.isLocked = true
      this.el.style.pointerEvents = 'none'
      this.el.style.opacity = '0.5'
    }
  }

  const applyWiggleAnimation = (plushie) => {
    if (!plushie || !plushie.isGrabbed) return

    const startTime = Date.now()
    const wiggle = () => {
      if (!plushie.isGrabbed) return

      const elapsed = (Date.now() - startTime) * CONFIG.ANIMATION.WIGGLE.SPEED
      const wiggleX =
        Math.sin(elapsed + CONFIG.ANIMATION.WIGGLE.PHASE) *
        CONFIG.ANIMATION.WIGGLE.AMPLITUDE

      plushie.el.style.transform = `rotate(-125deg) translateX(${wiggleX}px)`
      requestAnimationFrame(wiggle)
    }

    requestAnimationFrame(wiggle)
  }

  class Plushie {
    constructor(props) {
      const type = plushieTypes[Math.floor(Math.random() * plushieTypes.length)]
      const variants = plushieVariants[type]
      const variant = variants[Math.floor(Math.random() * variants.length)]

      const plushie = document.createElement('img')
      plushie.className = 'plushie'
      plushie.src = `assets/plushies/${variant}`

      this.el = plushie
      this.x = props.x
      this.y = props.y
      this.z = 0
      this.type = type
      this.variant = variant
      this.gridX = props.gridX
      this.gridY = props.gridY
      this.isGrabbed = false
      this.originalX = this.x
      this.originalY = this.y
      this.isDropped = false
      this.isCollected = false

      this.setStyles()
      elements.plushiesContainer.appendChild(this.el)
      elements.plushies.push(this)
    }

    setStyles() {
      Object.assign(this.el.style, {
        left: `${this.x}px`,
        top: `${this.y}px`,
        zIndex: this.z,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        pointerEvents: 'none',
        WebkitUserDrag: 'none',
        KhtmlUserDrag: 'none',
        MozUserDrag: 'none',
        OUserDrag: 'none',
        userDrag: 'none',
      })
    }

    grab() {
      this.isGrabbed = true
      this.el.classList.add('grabbed')
      this.z = 1000
      this.originalX = this.x
      this.originalY = this.y
      const grabbedVariant = `${this.type}_grabbed.png`
      this.el.src = `assets/plushies/${grabbedVariant}`
      this.el.style.transform = 'rotate(-125deg)'
      this.setStyles()

      applyWiggleAnimation(this)
    }

    drop() {
      this.isGrabbed = false
      this.isDropped = true
      this.el.classList.remove('grabbed')
      this.el.classList.add('dropped')
      this.el.style.transition = 'transform 0.5s ease-out, top 0.5s ease-out'
      this.el.style.transform = 'rotate(15deg)'
      this.y += CONFIG.PLUSHIE.DROP_OFFSET
      this.setStyles()

      this.el.style.pointerEvents = 'auto'
      this.el.style.cursor = 'pointer'
      this.el.addEventListener('click', () => this.collect())

      state.droppedPlushies.push(this)
    }

    collect() {
      if (this.isCollected) return

      this.isCollected = true
      this.el.classList.add('collected')
      this.z = 99999

      const machineRect = elements.machineInside.getBoundingClientRect()
      const plushieRect = this.el.getBoundingClientRect()

      const centerX = (machineRect.width - plushieRect.width) / 2
      const centerY = (machineRect.height - plushieRect.height) / 2.5

      this.el.style.transition = 'all 0.5s ease-out'
      this.el.style.position = 'fixed'
      this.el.style.left = `${machineRect.left + centerX}px`
      this.el.style.top = `${machineRect.top + centerY}px`
      this.el.style.transform = `scale(${CONFIG.PLUSHIE.COLLECTION.SCALE}) rotate(0deg)`
      this.el.style.zIndex = '99999'

      const handleSecondClick = () => {
        this.el.style.transition = 'all 0.3s ease-out'
        this.el.style.opacity = '0'
        this.el.style.transform = 'scale(0) rotate(0deg)'

        setTimeout(() => {
          this.el.remove()
          const index = state.droppedPlushies.indexOf(this)
          if (index > -1) {
            state.droppedPlushies.splice(index, 1)
          }

          if (state.droppedPlushies.length === 0) {
            const prizeSign = document.getElementById('prize-sign')
            prizeSign.classList.remove('blink')
          }
        }, CONFIG.ANIMATION.DURATION.FADE_OUT)
      }

      setTimeout(() => {
        this.el.addEventListener('click', handleSecondClick)
      }, CONFIG.ANIMATION.DURATION.COLLECTION)
    }
  }

  const updateButtonStates = (rightEnabled, topEnabled) => {
    const rightButtonGroup = document.querySelector('#button-right-group')
    const topButtonGroup = document.querySelector('#button-top-group')

    rightButtonGroup.style.pointerEvents = rightEnabled ? 'auto' : 'none'
    rightButtonGroup.style.opacity = rightEnabled ? '1' : '0.5'
    rightButtonGroup.style.fill = rightEnabled ? '#ff4444' : '#808080'

    topButtonGroup.style.pointerEvents = topEnabled ? 'auto' : 'none'
    topButtonGroup.style.opacity = topEnabled ? '1' : '0.5'
    topButtonGroup.style.fill = topEnabled ? '#ff4444' : '#808080'
  }

  function startMovingRight() {
    if (state.isMoving) return
    state.isMoving = true
    state.currentButton = 'right'
    updateButtonStates(true, false)

    elements.shadow.style.transform = `scale(${CONFIG.CLAW.SHADOW.INITIAL_SCALE})`

    state.moveInterval = setInterval(() => {
      if (
        !state.isMoving ||
        state.clawPosition.x >= CONFIG.CLAW.MOVEMENT.RIGHT.maxX
      ) {
        if (state.clawPosition.x >= CONFIG.CLAW.MOVEMENT.RIGHT.maxX)
          stopMoving()
        return
      }

      state.clawPosition.x += CONFIG.CLAW.MOVEMENT.RIGHT.speed
      state.shadowPosition.x += CONFIG.CLAW.MOVEMENT.RIGHT.speed

      elements.clawArm.style.left = `${state.clawPosition.x}px`
      elements.shadow.style.left = `${state.shadowPosition.x + 5}px`

      if (state.clawPosition.x >= CONFIG.CLAW.SHADOW.OPACITY_THRESHOLD) {
        elements.shadow.style.opacity = '0.5'
        elements.shadowOne.style.fillOpacity = 0.3
        elements.shadowTwo.style.fillOpacity = 0.3
      }
    }, 100)
  }

  function startMovingUp() {
    if (state.isMoving) return
    state.isMoving = true
    state.currentButton = 'up'
    updateButtonStates(false, true)

    state.moveInterval = setInterval(() => {
      if (
        !state.isMoving ||
        state.clawPosition.y <= CONFIG.CLAW.MOVEMENT.UP.maxY
      )
        return

      state.clawPosition.y -= CONFIG.CLAW.MOVEMENT.UP.speed
      state.shadowPosition.y -= CONFIG.CLAW.MOVEMENT.UP.speed

      elements.clawArm.style.top = `${state.clawPosition.y}px`
      elements.shadow.style.top = `${state.shadowPosition.y}px`

      if (state.clawPosition.y <= -300) {
        elements.shadow.style.opacity = '0.5'
        elements.shadowOne.style.fillOpacity = 0.3
        elements.shadowTwo.style.fillOpacity = 0.3
      }
    }, 100)
  }

  function stopMoving() {
    if (state.moveInterval) {
      clearInterval(state.moveInterval)
      state.moveInterval = null
    }
    state.isMoving = false

    if (state.currentButton === 'right') {
      updateButtonStates(false, true)
    } else if (state.currentButton === 'up') {
      updateButtonStates(false, false)
      startGrabbing()
    }
    state.currentButton = null
  }

  const getGrabChance = (clawPos, plushiePos, plushieRect) => {
    const machineRect = elements.machineInside.getBoundingClientRect();
    
    const normalizedClawPos = {
      x: clawPos.x - machineRect.left,
      y: clawPos.y - machineRect.top
    };
    
    const normalizedPlushiePos = {
      x: plushiePos.x - machineRect.left,
      y: plushiePos.y - machineRect.top
    };

    const clawCenter = {
      x: normalizedClawPos.x,
      y: normalizedClawPos.y,
    }

    const plushieCenter = {
      x: normalizedPlushiePos.x,
      y: normalizedPlushiePos.y,
    }

    const dx = clawCenter.x - plushieCenter.x
    const dy = clawCenter.y - plushieCenter.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > CONFIG.PLUSHIE.GRAB_RANGE) {
      if (CONFIG.PLUSHIE.GRAB.DEBUG) {
        // removed logger - use when grabbing range is a bit off
      }
      return 0
    }

    const horizontalAlignment = Math.abs(dx) / (plushieRect.width / 2)
    
    if (horizontalAlignment > 0.3) {
      if (CONFIG.PLUSHIE.GRAB.DEBUG) {
        // removed logger - use when grabbing range is a bit off
      }
      return 0
    }

    const verticalAlignment = Math.abs(dy) / (plushieRect.height / 2)

    const alignmentScore = Math.max(
      0,
      1 - Math.min(horizontalAlignment, verticalAlignment)
    )

    const verticalDistanceScore = Math.max(0, 1 - Math.abs(dy) / (plushieRect.height * 2))
    const horizontalDistanceScore = Math.max(0, 1 - Math.abs(dx) / (plushieRect.width / 2))
    const distanceScore = (verticalDistanceScore * 0.8 + horizontalDistanceScore * 0.2)

    const combinedScore =
      alignmentScore * 0.4 +
      verticalDistanceScore * 0.5 +
      horizontalDistanceScore * 0.1

    const grabChance =
      CONFIG.PLUSHIE.GRAB.MIN_GRAB_CHANCE +
      (CONFIG.PLUSHIE.GRAB.MAX_GRAB_CHANCE -
        CONFIG.PLUSHIE.GRAB.MIN_GRAB_CHANCE) *
        combinedScore

    if (CONFIG.PLUSHIE.GRAB.DEBUG) {
      // removed logger - use when grabbing range is a bit off
    }

    if (CONFIG.PLUSHIE.GRAB.VISUAL_FEEDBACK) {
      const shadow = elements.shadow
      const opacity = 0.5 + grabChance * 0.5
      shadow.style.opacity = opacity.toString()
      elements.shadowOne.style.fillOpacity = opacity * 0.6
      elements.shadowTwo.style.fillOpacity = opacity * 0.6
    }

    return grabChance
  }

  function startGrabbing() {
    if (state.isGrabbing) return
    state.isGrabbing = true

    const initialClawPos = { ...state.clawPosition }
    const initialShadowPos = { ...state.shadowPosition }

    // removed logger - use when grabbing range is a bit off

    resetAnimation(elements.clawLeft)
    resetAnimation(elements.clawRight)

    elements.clawLeft.style.animation = 'open-left 0.5s ease-out forwards'
    elements.clawRight.style.animation = 'open-right 0.5s ease-out forwards'

    setTimeout(() => {
      let currentTop = initialClawPos.y
      const targetTop = initialShadowPos.y
      let shadowScale = CONFIG.CLAW.SHADOW.INITIAL_SCALE

      const moveDown = setInterval(() => {
        currentTop += CONFIG.CLAW.MOVEMENT.DOWN.speed
        state.clawPosition.y = currentTop
        elements.clawArm.style.top = `${currentTop}px`
        elements.shadow.style.top = `${initialShadowPos.y}px`

        if (currentTop >= targetTop) {
          clearInterval(moveDown)
          resetAnimation(elements.clawLeft)
          resetAnimation(elements.clawRight)
          elements.clawLeft.style.animation =
            'close-left 0.5s ease-out forwards'
          elements.clawRight.style.animation =
            'close-right 0.5s ease-out forwards'

          if (state.targetPlushie) {
            state.targetPlushie.el.style.transition = 'transform 0.2s ease-in'
            state.targetPlushie.el.style.transform = 'rotate(-125deg)'
          }

          setTimeout(() => {
            const machineRect = elements.machineInside.getBoundingClientRect()
            const shadowRect = elements.shadow.getBoundingClientRect()
            const shadowPos = {
              x: shadowRect.left + shadowRect.width / 2 - machineRect.left,
              y: shadowRect.top + shadowRect.height / 2 - machineRect.top
            }

            // removed logger - use when grabbing range is a bit off

            let bestPlushie = null
            let bestGrabChance = 0

            elements.plushies.forEach((plushie) => {
              const plushieRect = plushie.el.getBoundingClientRect()
              const plushiePos = {
                x: plushieRect.left + plushieRect.width / 2 - machineRect.left,
                y: plushieRect.top + plushieRect.height / 2 - machineRect.top
              }
              const grabChance = getGrabChance(
                shadowPos,
                plushiePos,
                plushieRect
              )

              if (grabChance > bestGrabChance) {
                bestGrabChance = grabChance
                bestPlushie = plushie
              }
            })

            if (CONFIG.PLUSHIE.GRAB.DEBUG) {
              // removed logger - use when grabbing range is a bit off
            }

            if (
              bestPlushie &&
              bestGrabChance > CONFIG.PLUSHIE.GRAB.MIN_GRAB_CHANCE
            ) {
              if (Math.random() < bestGrabChance) {
                state.targetPlushie = bestPlushie
                bestPlushie.grab()

                state.plushieOffset = {
                  x: state.clawPosition.x - bestPlushie.x,
                  y: state.clawPosition.y - bestPlushie.y,
                }

                const scaleStep = (CONFIG.CLAW.SHADOW.TARGET_SCALE - CONFIG.CLAW.SHADOW.INITIAL_SCALE) / CONFIG.CLAW.SHADOW.SCALE_STEPS
                const scaleUp = setInterval(() => {
                  if (shadowScale < CONFIG.CLAW.SHADOW.TARGET_SCALE) {
                    shadowScale += scaleStep
                    elements.shadow.style.transform = `scale(${shadowScale})`
                  } else {
                    clearInterval(scaleUp)
                  }
                }, 50)

                // removed logger - use when grabbing range is a bit off

                setTimeout(returnToTop, CONFIG.ANIMATION.DURATION.CLAW)
              } else {
                if (CONFIG.PLUSHIE.GRAB.DEBUG) {
                  // removed logger - use when grabbing range is a bit off
                }
                returnToTop()
              }
            } else {
              if (CONFIG.PLUSHIE.GRAB.DEBUG) {
                // removed logger - use when grabbing range is a bit off
              }
              returnToTop()
            }
          }, CONFIG.ANIMATION.DURATION.CLAW)
        }
      }, 50)
    }, CONFIG.ANIMATION.DURATION.CLAW)
  }

  function returnToTop() {
    let currentTop = state.clawPosition.y

    const moveUp = setInterval(() => {
      currentTop -= 6
      state.clawPosition.y = currentTop
      elements.clawArm.style.top = `${currentTop}px`

      if (state.targetPlushie) {
        state.targetPlushie.x = state.clawPosition.x - state.plushieOffset.x
        state.targetPlushie.y = state.clawPosition.y - state.plushieOffset.y
        state.targetPlushie.setStyles()
      }

      if (currentTop <= -280) {
        clearInterval(moveUp)
        elements.shadow.style.transform = `scale(${CONFIG.CLAW.SHADOW.INITIAL_SCALE})`
        moveToInitialPosition()
      }
    }, 50)
  }

  function moveToInitialPosition() {
    let currentLeft = state.clawPosition.x

    const moveLeft = setInterval(() => {
      currentLeft -= CONFIG.CLAW.MOVEMENT.LEFT.speed
      state.clawPosition.x = currentLeft
      elements.clawArm.style.left = `${currentLeft}px`
      state.shadowPosition.x = currentLeft
      elements.shadow.style.left = `${state.shadowPosition.x + 5}px`

      if (state.targetPlushie) {
        state.targetPlushie.x = state.clawPosition.x - state.plushieOffset.x
        state.targetPlushie.y = state.clawPosition.y - state.plushieOffset.y
        state.targetPlushie.setStyles()
      }

      if (currentLeft <= CONFIG.CLAW.MOVEMENT.LEFT.targetX) {
        clearInterval(moveLeft)
        resetAnimation(elements.clawLeft)
        resetAnimation(elements.clawRight)
        elements.clawLeft.style.animation = 'open-left 0.5s ease-out forwards'
        elements.clawRight.style.animation = 'open-right 0.5s ease-out forwards'

        setTimeout(() => {
          if (state.targetPlushie) {
            state.targetPlushie.drop()
            const prizeSign = document.getElementById('prize-sign')
            prizeSign.classList.add('blink')
            state.targetPlushie = null
            state.plushieOffset = null
          }

          state.clawPosition = { ...CONFIG.CLAW.INITIAL_POSITION }
          state.shadowPosition = { ...CONFIG.CLAW.SHADOW_INITIAL_POSITION }

          elements.clawArm.style.top = '-260px'
          elements.clawArm.style.left = '10px'

          elements.shadow.style.top = '-180px'
          elements.shadow.style.left = '15px'
          elements.shadow.style.opacity = '0'
          elements.shadow.style.transform = `scale(${CONFIG.CLAW.SHADOW.INITIAL_SCALE})`
          elements.shadowOne.style.fillOpacity = '0'
          elements.shadowTwo.style.fillOpacity = '0'

          resetAnimation(elements.clawLeft)
          resetAnimation(elements.clawRight)
          elements.clawLeft.style.animation = 'close-left 2s ease-out forwards'
          elements.clawRight.style.animation =
            'close-right 2s ease-out forwards'

          state.isGrabbing = false
          updateButtonStates(true, false)
        }, CONFIG.ANIMATION.DURATION.CLAW)
      }
    }, 50)
  }

  function init() {
    const _rightButton = new Button({
      element: elements.buttonRight,
      isLocked: false,
      pressAction: () => startMovingRight(),
      releaseAction: () => stopMoving(),
    })

    const _topButton = new Button({
      element: elements.buttonTop,
      isLocked: true,
      pressAction: () => startMovingUp(),
      releaseAction: () => stopMoving(),
    })

    updateButtonStates(true, false)
    placePlushies()
  }

  function placePlushies() {
    const containerRect = elements.plushiesContainer.getBoundingClientRect()
    const cellWidth = containerRect.width / 4
    const cellHeight = containerRect.height / 3
    const leftOffset = -20

    for (let i = 0; i < 8; i++) {
      const gridX = i % 4
      const gridY = Math.floor(i / 4)
      const baseX = gridX * cellWidth + cellWidth / 2 + leftOffset
      const baseY =
        gridY * cellHeight + cellHeight / 2 - (gridY === 0 ? 50 : 80)
      const x = baseX + randomN(-20, 20)
      const y = baseY + randomN(-20, 20)

      new Plushie({ x, y, gridX, gridY })
    }

    for (let i = 0; i < 2; i++) {
      const gridX = i + 1
      const gridY = 2
      const baseX = gridX * cellWidth + cellWidth / 2 + leftOffset
      const baseY = gridY * cellHeight + cellHeight / 2 - 100
      const x = baseX + randomN(-20, 20)
      const y = baseY + randomN(-20, 20)

      new Plushie({ x, y, gridX, gridY })
    }
  }

  init()
})