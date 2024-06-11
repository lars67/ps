type FetchResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function safeFetch<T>(
  url: string,
  options: RequestInit = {credentials: 'include'},
): Promise<FetchResponse<T>> {


  try {
    const response = await fetch(`${process.env.REACT_APP_URL_DATA}/${url}`, options);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! Status: ${response.status}`,
      };
    }

    const data: T = await response.json();
    return { success: true, data };
  } catch (error: any) {
       return { success: false, error: error.message };

  }
}
