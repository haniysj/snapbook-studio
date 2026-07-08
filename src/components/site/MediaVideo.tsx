import { useQuery } from "@tanstack/react-query";
import { signedMediaUrl } from "@/lib/helpers";

type Props = {
  path: string | null | undefined;
} & Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src">;

export function MediaVideo({ path, ...rest }: Props) {
  const { data: src } = useQuery({
    queryKey: ["signed-media", path],
    queryFn: () => signedMediaUrl(path),
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
  });
  if (!src) return null;
  return <video src={src} {...rest} />;
}
