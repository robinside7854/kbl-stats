import { Composition } from "remotion";
import { TopScorers } from "./TopScorers";
import { Milestones } from "./Milestones";
import { Quiz } from "./Quiz";
import { Flip } from "./Flip";
import { FPS, H, W } from "./theme";
import type { EpisodeProps } from "./types";

// 장면 길이 = 목소리 길이 — props.json 의 장면 초를 더해 전체 길이를 정한다
const fromScenes = ({ props }: { props: { scenes?: { seconds: number }[] } }) => ({
  durationInFrames: Math.max(FPS, (props.scenes ?? []).reduce((a, s) => a + Math.round(s.seconds * FPS), 0)),
});

// 포맷마다 컴포지션 하나 (에피소드 JSON 의 composition 값). 반응 비교용으로 디자인을 서로 완전히 다르게 둔다
export function Root() {
  return (
    <>
      <Composition id="TopScorers" component={TopScorers} width={W} height={H} fps={FPS} durationInFrames={30 * FPS} defaultProps={{} as EpisodeProps} calculateMetadata={fromScenes} />
      <Composition id="Milestones" component={Milestones} width={W} height={H} fps={FPS} durationInFrames={30 * FPS} defaultProps={{} as never} calculateMetadata={fromScenes} />
      <Composition id="Flip" component={Flip} width={W} height={H} fps={FPS} durationInFrames={30 * FPS} defaultProps={{} as never} calculateMetadata={fromScenes} />
      <Composition id="Quiz" component={Quiz} width={W} height={H} fps={FPS} durationInFrames={30 * FPS} defaultProps={{} as never} calculateMetadata={fromScenes} />
    </>
  );
}
