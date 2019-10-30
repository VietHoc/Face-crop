import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OpenCvService {
  readonly url = `http://127.0.0.1:8000/api/image/`;
  readonly headers = {
    headers: new HttpHeaders({
      // 'Content-Type': 'application/x-www-form-urlencoded'
      'Content-Type': 'application/json'
    })
  };

  constructor(
    private http: HttpClient
  ) {
  }

  validatorImage(image): Observable<any> {
    return this.http.post(this.url, {image}, this.headers);
  }
}
