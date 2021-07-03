export interface URL {
    url: string;
    importer: string;
    tags?: string[];
}

export interface DetailUrl {
    textId: string;
    importer: string;
    postTags: string[];
    platform: string;
    username?: string
}