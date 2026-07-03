import { useQuery } from "@tanstack/react-query";
import { signedMediaUrl } from "@/lib/helpers";

type Props = {
  path: string | null | undefined;
  fallback?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">;

export function MediaImage({ path, fallback, alt = "", ...rest }: Props) {
  const { data: src } = useQuery({
    queryKey: ["signed-media", path],
    queryFn: () => signedMediaUrl(path),
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
  });
  const finalSrc = src || fallback;
  if (!finalSrc) return null;
  return <img src={finalSrc} alt={alt} {...rest} />;
}
