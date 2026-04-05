import PostLoadForm from "@/components/loads/PostLoadForm";

export const metadata = { title: "Post a Load" };

export default function PostLoadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Post a Load</h1>
        <p className="text-sm text-slate-500 mt-1">
          Fill in the details below. Once published, transporters will bid in real time.
        </p>
      </div>
      <PostLoadForm />
    </div>
  );
}
