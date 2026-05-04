import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle, FontSize, FontFamily, Color } from "@tiptap/extension-text-style";
import { useEffect } from "react";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Strikethrough } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  disabled?: boolean;
}

const FONT_FAMILIES = [
  { label: "Par défaut", value: "" },
  { label: "Sans-serif", value: "Inter, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, Menlo, monospace" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times", value: '"Times New Roman", Times, serif' },
];

const FONT_SIZES = [
  { label: "XS", value: "12px" },
  { label: "S", value: "14px" },
  { label: "M", value: "16px" },
  { label: "L", value: "18px" },
  { label: "XL", value: "22px" },
  { label: "2XL", value: "28px" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 120,
  disabled,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      FontFamily.configure({ types: ["textStyle"] }),
      Color.configure({ types: ["textStyle"] }),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2",
          "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1",
        ),
        style: `min-height: ${minHeight}px`,
        "data-placeholder": placeholder || "",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Sync external value changes (ex: edit dialog reload)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || "";
    if (incoming !== current && incoming !== "" || (incoming === "" && current !== "<p></p>")) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-surface-sunken focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const currentFont =
    FONT_FAMILIES.find(f => editor.getAttributes("textStyle").fontFamily === f.value)?.value ?? "";
  const currentSize = editor.getAttributes("textStyle").fontSize || "";

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5 bg-muted/30 rounded-t-md">
      <Select
        value={currentFont}
        onValueChange={(v) => {
          if (!v) editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(v).run();
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-7 w-[110px] text-xs">
          <SelectValue placeholder="Police" />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f.label} value={f.value || "default"} onPointerDown={(e) => {
              if (!f.value) {
                e.preventDefault();
                editor.chain().focus().unsetFontFamily().run();
              }
            }}>
              <span style={{ fontFamily: f.value || undefined }}>{f.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentSize}
        onValueChange={(v) => {
          if (!v || v === "reset") editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(v).run();
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-7 w-[70px] text-xs">
          <SelectValue placeholder="Taille" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="reset">Auto</SelectItem>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <span style={{ fontSize: s.value }}>{s.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mx-1 h-5 w-px bg-border" />

      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        disabled={disabled}
        aria-label="Gras"
        className="h-7 w-7 p-0"
      >
        <Bold className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        disabled={disabled}
        aria-label="Italique"
        className="h-7 w-7 p-0"
      >
        <Italic className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("underline")}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        disabled={disabled}
        aria-label="Souligné"
        className="h-7 w-7 p-0"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        disabled={disabled}
        aria-label="Barré"
        className="h-7 w-7 p-0"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Toggle>

      <div className="mx-1 h-5 w-px bg-border" />

      <Toggle
        size="sm"
        pressed={editor.isActive("bulletList")}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        disabled={disabled}
        aria-label="Liste à puces"
        className="h-7 w-7 p-0"
      >
        <List className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("orderedList")}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={disabled}
        aria-label="Liste numérotée"
        className="h-7 w-7 p-0"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Toggle>

      <div className="mx-1 h-5 w-px bg-border" />

      <input
        type="color"
        title="Couleur du texte"
        className="h-6 w-7 cursor-pointer rounded border border-border bg-transparent p-0"
        value={editor.getAttributes("textStyle").color || "#000000"}
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        disabled={disabled}
      />
    </div>
  );
}
