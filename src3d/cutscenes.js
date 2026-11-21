// Cutscene scripts. Each shot:
//   image    — assets/cutscenes/<id>.png (also tries .jpg/.jpeg/.webp). Missing → code-drawn placeholder.
//   text     — subtitle, typed out on screen
//   voice    — assets/audio/<voice>.mp3 (optional). The shot waits for the line to finish.
//   duration — minimum seconds on screen
//   art      — which placeholder to draw while the real image doesn't exist yet
//   title    — show the BINARY CORE title card on this shot

export const CUTSCENES = {
  intro: [
    { image: 'assets/cutscenes/intro_01.png', voice: 'vo_intro_01', cue: 'cs_ship', duration: 6, art: 'ship',
      text: 'The starship Meridian drifts through the dark. Its engines have gone silent.' },
    { image: 'assets/cutscenes/intro_02.png', voice: 'vo_intro_02', cue: 'cs_core', duration: 6, art: 'core',
      text: 'At its heart beat the Binary Core: Sol and Cryo, two elements bound as one.' },
    { image: 'assets/cutscenes/intro_03.png', voice: 'vo_intro_03', cue: 'cs_fracture', duration: 4.8, art: 'fracture',
      text: 'Then the core fractured.' },
    { image: 'assets/cutscenes/intro_04.png', voice: 'vo_intro_04', cue: 'cs_apart', duration: 6, art: 'apart',
      text: 'Apart, they cannot last. Sol burns away. Cryo boils into nothing.' },
    { image: 'assets/cutscenes/intro_05.png', voice: 'vo_intro_05', cue: 'cs_crucible', duration: 5.5, art: 'crucible',
      text: 'Its reactor runs through a chain of Crucibles, one on every deck. Each one is cooling.' },
    { image: 'assets/cutscenes/intro_06.png', voice: 'vo_intro_06', cue: 'cs_title', duration: 6, art: 'title', title: true,
      text: 'Relight the reactor, deck by deck. Bring them together, as many times as it takes.' },
  ],
};
