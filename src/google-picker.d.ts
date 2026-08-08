declare namespace google.picker {
  enum Action { PICKED = 'picked', CANCEL = 'cancel' }
  enum ViewId { SPREADSHEETS = 'spreadsheets' }
  type ResponseObject = { action: Action; docs?: Array<{ id: string; name: string }> };
  class DocsView {
    constructor(viewId: ViewId);
    setMimeTypes(value: string): this;
    setSelectFolderEnabled(value: boolean): this;
  }
  class PickerBuilder {
    addView(view: DocsView): this;
    setAppId(value: string): this;
    setDeveloperKey(value: string): this;
    setOAuthToken(value: string): this;
    setOrigin(value: string): this;
    setCallback(callback: (event: ResponseObject) => void): this;
    build(): { setVisible(value: boolean): void };
  }
}

declare namespace gapi {
  function load(name: string, options: { callback: () => void; onerror: () => void }): void;
}
