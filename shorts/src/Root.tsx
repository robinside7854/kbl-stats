import { Composition } from "remotion";
import { TopScorers } from "./TopScorers";
import { FPS, H, W } from "./theme";
import type { EpisodeProps } from "./types";

export function Root() {
  return (
    <Composition
      id="TopScorers"
      component={TopScorers}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={{} as EpisodeProps}
      // 장면 길이 = 목소리 길이 — props.json 의 장면 초를 더해 전체 길이를 정한다
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(
          FPS,
          (props.scenes ?? []).reduce((a, s) => a + Math.round(s.seconds * FPS), 0),
        ),
      })}
    />
  );
}
