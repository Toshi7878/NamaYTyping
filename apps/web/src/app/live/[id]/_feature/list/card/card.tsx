import type { ResultModel } from "@repo/firestore";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/button";
import { Card, CardContentWithThumbnail } from "@repo/ui/card";
import { TooltipWrapper } from "@repo/ui/tooltip";
import type { HTMLAttributes } from "react";
import { nolink } from "@/utils/no-link";
import { getYouTubeThumbnailUrl } from "@/utils/youtube";
import { RatingBadge } from "./rating-badge";
import { MapThumbnailImage } from "./thumbnail-image";

interface ResultCardProps {
  result: ResultModel;
  initialInView?: boolean;
  onSelect: () => void;
}

export const ResultCard = ({
  result,
  initialInView = false,
  onSelect,
}: ResultCardProps) => {
  const src = getYouTubeThumbnailUrl(
    result.map.media.videoId,
    result.map.media.thumbnailQuality,
  );

  return (
    <Card className="map-card-hover block w-full py-0 transition-shadow duration-300">
      <CardContentWithThumbnail
        src={src}
        className="relative flex items-center gap-4 py-2"
      >
        <MapThumbnailImage
          alt={result.map.info.title}
          media={result.map.media}
          size="xs"
          priority={initialInView}
        />

        <MapInfo
          map={result.map}
          className="flex-1 cursor-pointer"
          onClick={() => {
            onSelect();
          }}
        />
      </CardContentWithThumbnail>
    </Card>
  );
};

interface MapInfoProps {
  map: ResultModel["map"];
}

const MapInfo = ({
  map,
  className,
  ...rest
}: MapInfoProps & HTMLAttributes<HTMLDivElement>) => {
  const musicSource = map.info.source ? `【${map.info.source}】` : "";

  return (
    <div className={cn("flex flex-col gap-2 truncate", className)} {...rest}>
      <div className="flex items-center gap-2 justify-between">
        <TooltipWrapper
          label={nolink(
            `${map.info.title} / ${map.info.artistName}${musicSource}`,
          )}
          asChild
        >
          <div className="truncate font-bold text-sm sm:text-base">
            {nolink(`${map.info.title} / ${map.info.artistName}`)}
          </div>
        </TooltipWrapper>
        <Button variant="link" asChild>
          <a
            href={`https://ytyping.net/type/${map.mapId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cyan-500 hover:underline"
          >
            譜面ページを開く
          </a>
        </Button>
      </div>

      <RatingBadge rating={map.rating} />
    </div>
  );
};
