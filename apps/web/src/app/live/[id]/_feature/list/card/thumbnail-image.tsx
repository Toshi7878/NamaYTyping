import type { ResultModel } from "@repo/firestore";
import type { VariantProps } from "@repo/ui";
import { cn } from "@repo/ui";
import { ThumbnailImage, thumbnailImageVariants } from "@repo/ui/image";
import { useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa";
import { useIsPreviewEnabled } from "@/app/_layout/preview-youtube";
import {
  getPreviewYTPlayer,
  resetPreviewVideoInfo,
  setPreviewVideoInfo,
  usePreviewVideoInfo,
  usePreviewYTPlayer,
} from "@/store/preview-yt-player";
import { getYouTubeThumbnailUrl } from "@/utils/youtube";

interface MapThumbnailImageProps {
  alt: string;
  media?: ResultModel["map"]["media"];
  size: VariantProps<typeof thumbnailImageVariants>["size"];
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}

export const MapThumbnailImage = (props: MapThumbnailImageProps) => {
  const {
    alt,
    media,
    size,
    className,
    imageClassName,
    priority = false,
  } = props;

  const isPreviewEnabled = useIsPreviewEnabled();
  const previewYTPlayer = usePreviewYTPlayer();

  return (
    <div className={cn("group relative my-auto select-none", className)}>
      {media ? (
        <>
          {isPreviewEnabled && previewYTPlayer && (
            <ThumbnailPreviewCover {...media} className={imageClassName} />
          )}
          <ThumbnailImage
            src={getYouTubeThumbnailUrl(media.videoId, "mqdefault")}
            alt={alt}
            size={size}
            className={imageClassName}
            priority={priority}
          />
        </>
      ) : (
        <div
          className={cn(
            thumbnailImageVariants({ size }),
            "flex flex-start items-center justify-center",
          )}
        >
          {alt}
        </div>
      )}
    </div>
  );
};

const ThumbnailPreviewCover = (
  props: ResultModel["map"]["media"] & { className?: string },
) => {
  const { videoId: mapVideoId, previewTime: mapPreviewTime } = props;
  const { videoId } = usePreviewVideoInfo();
  const [isTouchMove, setIsTouchMove] = useState(false);

  const previewYouTube = () => {
    if (videoId !== mapVideoId) {
      if (!getPreviewYTPlayer()) return;
      setPreviewVideoInfo({
        videoId: mapVideoId,
        previewTime: mapPreviewTime,
      });
    } else {
      resetPreviewVideoInfo();
    }
  };

  const handleTouchMove = () => {
    setIsTouchMove(true);
  };

  const handleTouchEnd = () => {
    if (!isTouchMove) {
      if (videoId !== mapVideoId) {
        previewYouTube();
      }
    }
    setIsTouchMove(false);
  };

  const isActive = videoId === mapVideoId;

  return (
    <button
      type="button"
      className={cn(
        "absolute inset-0 z-1 inline-flex size-full cursor-pointer items-center justify-center overflow-hidden rounded-md",
        isActive
          ? "bg-black/50 opacity-100"
          : "bg-black/30 opacity-0 group-hover:opacity-100",
        props.className,
      )}
      onClick={previewYouTube}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isActive ? (
        <FaPause color="white" size={35} />
      ) : (
        <FaPlay color="white" size={35} />
      )}
    </button>
  );
};
